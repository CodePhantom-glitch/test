// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FlashAIArbitrageExecutor
 * @notice Non-custodial, owner-controlled Flash-Loan Arbitrage Executor with:
 *         - Two-step ownership verification (Ownable2Step pattern)
 *         - Reentrancy protection & Active Flash-Loan Execution Lock
 *         - Emergency Pause / Unpause controls (whenNotPaused / whenPaused)
 *         - Verified Profit Recipient distribution with duplicate-transfer idempotency guard
 *         - Emergency Token & Native ETH Recovery restricted to authorized destinations
 * @dev Access control alone does not guarantee contract security. Always complete an
 *      independent external audit and testnet verification before mainnet deployment.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IUniswapV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract FlashAIArbitrageExecutor {
    // --- Custom Errors ---
    error UnauthorizedCaller(address caller, address expectedOwner);
    error UnauthorizedInitiator(address initiator);
    error ContractPaused();
    error ContractNotPaused();
    error ReentrancyBlocked();
    error FlashLoanActiveLock();
    error InvalidRouteLength();
    error UnapprovedRouter(address router);
    error UnsupportedToken(address token);
    error DeadlineExpired(uint256 deadline, uint256 currentTimestamp);
    error InsufficientRepayment(uint256 balanceAfter, uint256 requiredRepayment);
    error NetProfitBelowThreshold(uint256 actualNetProfit, uint256 minRequiredNetProfit);
    error InsufficientContractBalance(uint256 requested, uint256 available);
    error DuplicateProfitTransfer(bytes32 transferId);
    error UnauthorizedRecipient(address recipient);
    error ZeroAddressNotAllowed();
    error ZeroAmountNotAllowed();
    error SafeTransferFailed();

    // --- Events ---
    event ArbitrageExecuted(
        address indexed asset,
        uint256 borrowedAmount,
        uint256 flashLoanFee,
        uint256 netProfit,
        uint256 hopCount,
        uint256 timestamp
    );
    event RouterApprovalUpdated(address indexed router, bool approved);
    event SupportedTokenUpdated(address indexed token, bool supported);
    event ProfitRecipientUpdated(address indexed previousRecipient, address indexed newRecipient);
    event MinimumProfitThresholdUpdated(address indexed token, uint256 minProfitUnits);
    event EmergencyPausedStateChanged(bool isPaused, address indexed triggeredBy, uint256 timestamp);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ResidualProfitTransferred(
        bytes32 indexed transferId,
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    event EmergencyAssetRecovered(
        address indexed token,
        address indexed destination,
        uint256 amount,
        address indexed triggeredBy,
        uint256 timestamp
    );

    // --- Constants & State Variables ---
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 public constant MAX_ALLOWED_HOPS = 4;

    uint256 private _reentrancyStatus;
    bool private _flashLoanInProgress;
    bool public paused;

    address public owner;
    address public pendingOwner;
    address public profitRecipient;

    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IPool public immutable POOL;

    mapping(address => bool) public approvedRouters;
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public tokenMinProfitThreshold;
    mapping(bytes32 => bool) public executedProfitTransfers;
    mapping(address => bool) public authorizedRecoveryDestinations;

    struct SwapHop {
        address router;
        uint8 routerType; // 1 = UniswapV2-style, 2 = UniswapV3-style
        address tokenIn;
        address tokenOut;
        uint24 poolFee;
        uint256 minAmountOut;
    }

    struct ArbitrageParams {
        SwapHop[] hops;
        uint256 minNetProfit;
        uint256 deadline;
        bool autoForwardProfit;
    }

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert UnauthorizedCaller(msg.sender, owner);
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus == _ENTERED) revert ReentrancyBlocked();
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    modifier whenNoActiveFlashLoan() {
        if (_flashLoanInProgress) revert FlashLoanActiveLock();
        _;
    }

    constructor(
        address providerAddress,
        address initialProfitRecipient,
        address[] memory initialRouters,
        address[] memory initialTokens
    ) {
        if (providerAddress == address(0) || initialProfitRecipient == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        owner = msg.sender;
        profitRecipient = initialProfitRecipient;
        authorizedRecoveryDestinations[msg.sender] = true;
        authorizedRecoveryDestinations[initialProfitRecipient] = true;
        _reentrancyStatus = _NOT_ENTERED;

        ADDRESSES_PROVIDER = IPoolAddressesProvider(providerAddress);
        address poolAddr = IPoolAddressesProvider(providerAddress).getPool();
        if (poolAddr == address(0)) revert ZeroAddressNotAllowed();
        POOL = IPool(poolAddr);

        for (uint256 i = 0; i < initialRouters.length; i++) {
            if (initialRouters[i] == address(0)) revert ZeroAddressNotAllowed();
            approvedRouters[initialRouters[i]] = true;
            emit RouterApprovalUpdated(initialRouters[i], true);
        }

        for (uint256 j = 0; j < initialTokens.length; j++) {
            if (initialTokens[j] == address(0)) revert ZeroAddressNotAllowed();
            supportedTokens[initialTokens[j]] = true;
            emit SupportedTokenUpdated(initialTokens[j], true);
        }
    }

    // --- Owner-Only Configuration & Access Control ---
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPausedStateChanged(_paused, msg.sender, block.timestamp);
    }

    function setRouterApproval(address router, bool approved) external onlyOwner {
        if (router == address(0)) revert ZeroAddressNotAllowed();
        approvedRouters[router] = approved;
        emit RouterApprovalUpdated(router, approved);
    }

    function setSupportedToken(address token, bool supported, uint256 minProfitUnits) external onlyOwner {
        if (token == address(0)) revert ZeroAddressNotAllowed();
        supportedTokens[token] = supported;
        tokenMinProfitThreshold[token] = minProfitUnits;
        emit SupportedTokenUpdated(token, supported);
        emit MinimumProfitThresholdUpdated(token, minProfitUnits);
    }

    function setProfitRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddressNotAllowed();
        address old = profitRecipient;
        profitRecipient = newRecipient;
        authorizedRecoveryDestinations[newRecipient] = true;
        emit ProfitRecipientUpdated(old, newRecipient);
    }

    function setAuthorizedRecoveryDestination(address destination, bool authorized) external onlyOwner {
        if (destination == address(0)) revert ZeroAddressNotAllowed();
        authorizedRecoveryDestinations[destination] = authorized;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0) || newOwner == owner) revert ZeroAddressNotAllowed();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert UnauthorizedCaller(msg.sender, pendingOwner);
        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        authorizedRecoveryDestinations[owner] = true;
        emit OwnershipTransferred(oldOwner, owner);
    }

    // --- Flash Loan Initiation ---
    function requestFlashLoanArbitrage(
        address asset,
        uint256 amount,
        ArbitrageParams calldata arbParams
    ) external onlyOwner whenNotPaused nonReentrant whenNoActiveFlashLoan {
        if (!supportedTokens[asset]) revert UnsupportedToken(asset);
        if (amount == 0) revert ZeroAmountNotAllowed();
        if (block.timestamp > arbParams.deadline) {
            revert DeadlineExpired(arbParams.deadline, block.timestamp);
        }
        if (arbParams.hops.length == 0 || arbParams.hops.length > MAX_ALLOWED_HOPS) {
            revert InvalidRouteLength();
        }
        if (arbParams.hops[0].tokenIn != asset) revert InvalidRouteLength();
        if (arbParams.hops[arbParams.hops.length - 1].tokenOut != asset) revert InvalidRouteLength();

        _flashLoanInProgress = true;
        bytes memory encodedParams = abi.encode(arbParams);
        POOL.flashLoanSimple(address(this), asset, amount, encodedParams, 0);
        _flashLoanInProgress = false;
    }

    // --- Aave V3 Callback ---
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external whenNotPaused returns (bool) {
        if (msg.sender != address(POOL)) revert UnauthorizedCaller(msg.sender, address(POOL));
        if (initiator != address(this) || !_flashLoanInProgress) revert UnauthorizedInitiator(initiator);

        ArbitrageParams memory arbParams = abi.decode(params, (ArbitrageParams));
        if (block.timestamp > arbParams.deadline) {
            revert DeadlineExpired(arbParams.deadline, block.timestamp);
        }

        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));
        uint256 currentAmountIn = amount;

        for (uint256 i = 0; i < arbParams.hops.length; i++) {
            SwapHop memory hop = arbParams.hops[i];
            if (!approvedRouters[hop.router]) revert UnapprovedRouter(hop.router);
            if (!supportedTokens[hop.tokenIn] || !supportedTokens[hop.tokenOut]) {
                revert UnsupportedToken(hop.tokenOut);
            }

            _safeApprove(hop.tokenIn, hop.router, 0);
            _safeApprove(hop.tokenIn, hop.router, currentAmountIn);

            if (hop.routerType == 2) {
                currentAmountIn = IUniswapV3SwapRouter(hop.router).exactInputSingle(
                    IUniswapV3SwapRouter.ExactInputSingleParams({
                        tokenIn: hop.tokenIn,
                        tokenOut: hop.tokenOut,
                        fee: hop.poolFee,
                        recipient: address(this),
                        deadline: arbParams.deadline,
                        amountIn: currentAmountIn,
                        amountOutMinimum: hop.minAmountOut,
                        sqrtPriceLimitX96: 0
                    })
                );
            } else {
                address[] memory path = new address[](2);
                path[0] = hop.tokenIn;
                path[1] = hop.tokenOut;
                uint256[] memory amounts = IUniswapV2Router02(hop.router).swapExactTokensForTokens(
                    currentAmountIn,
                    hop.minAmountOut,
                    path,
                    address(this),
                    arbParams.deadline
                );
                currentAmountIn = amounts[amounts.length - 1];
            }

            _safeApprove(hop.tokenIn, hop.router, 0);
        }

        uint256 totalDebt = amount + premium;
        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        uint256 baselineBalance = balanceBefore - amount;

        if (finalBalance < baselineBalance + totalDebt) {
            revert InsufficientRepayment(finalBalance, baselineBalance + totalDebt);
        }

        uint256 netProfit = finalBalance - (baselineBalance + totalDebt);
        uint256 requiredProfit = arbParams.minNetProfit > tokenMinProfitThreshold[asset]
            ? arbParams.minNetProfit
            : tokenMinProfitThreshold[asset];

        if (netProfit < requiredProfit) {
            revert NetProfitBelowThreshold(netProfit, requiredProfit);
        }

        // Approve Aave V3 Pool to pull principal + flash-loan fee first
        _safeApprove(asset, address(POOL), 0);
        _safeApprove(asset, address(POOL), totalDebt);

        // Optional pre-authorized profit forwarding only after repayment is reserved
        if (arbParams.autoForwardProfit && profitRecipient != address(0) && netProfit > 0) {
            _safeTransfer(asset, profitRecipient, netProfit);
        }

        emit ArbitrageExecuted(asset, amount, premium, netProfit, arbParams.hops.length, block.timestamp);
        return true;
    }

    // --- Profit Transfer to Verified Owner Recipient (Non-Custodial, Idempotent) ---
    function transferResidualProfit(
        bytes32 transferId,
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant whenNoActiveFlashLoan {
        if (executedProfitTransfers[transferId]) revert DuplicateProfitTransfer(transferId);
        if (!supportedTokens[token]) revert UnsupportedToken(token);
        if (profitRecipient == address(0)) revert ZeroAddressNotAllowed();
        if (amount == 0) revert ZeroAmountNotAllowed();

        uint256 minThreshold = tokenMinProfitThreshold[token];
        if (amount < minThreshold) {
            revert NetProfitBelowThreshold(amount, minThreshold);
        }

        uint256 availableBalance = IERC20(token).balanceOf(address(this));
        if (availableBalance < amount) {
            revert InsufficientContractBalance(amount, availableBalance);
        }

        executedProfitTransfers[transferId] = true;
        _safeTransfer(token, profitRecipient, amount);

        emit ResidualProfitTransferred(transferId, token, profitRecipient, amount, block.timestamp);
    }

    // --- Emergency Asset Recovery (Strictly Separated from Pause, Restricted Destinations) ---
    function emergencyRecoverToken(
        address token,
        address destination,
        uint256 amount
    ) external onlyOwner nonReentrant whenNoActiveFlashLoan {
        if (token == address(0) || destination == address(0)) revert ZeroAddressNotAllowed();
        if (!authorizedRecoveryDestinations[destination]) revert UnauthorizedRecipient(destination);
        if (amount == 0) revert ZeroAmountNotAllowed();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) revert InsufficientContractBalance(amount, balance);

        _safeTransfer(token, destination, amount);
        emit EmergencyAssetRecovered(token, destination, amount, msg.sender, block.timestamp);
    }

    function emergencyRecoverNative(
        address payable destination,
        uint256 amount
    ) external onlyOwner nonReentrant whenNoActiveFlashLoan {
        if (destination == address(0)) revert ZeroAddressNotAllowed();
        if (!authorizedRecoveryDestinations[destination]) revert UnauthorizedRecipient(destination);
        if (amount == 0) revert ZeroAmountNotAllowed();
        if (address(this).balance < amount) {
            revert InsufficientContractBalance(amount, address(this).balance);
        }

        (bool success, ) = destination.call{value: amount}("");
        if (!success) revert SafeTransferFailed();
        emit EmergencyAssetRecovered(address(0), destination, amount, msg.sender, block.timestamp);
    }

    // --- Safe ERC20 Internal Helpers ---
    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert SafeTransferFailed();
        }
    }

    function _safeApprove(address token, address spender, uint256 value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, value));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert SafeTransferFailed();
        }
    }

    receive() external payable {}
}
