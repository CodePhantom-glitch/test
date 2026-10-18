import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  DollarSign,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  ContractSecurityState,
  RecordedContractTransaction,
  TransactionPreviewPayload,
  WalletSessionState,
} from '../types/arbitrage.ts';
import {
  SUPPORTED_CHAINS,
  shortenAddress,
  validateEthereumAddress,
} from '../lib/web3Wallet.ts';

interface EmergencyRecoveryAndProfitViewProps {
  initialMode: 'RECOVERY' | 'PROFIT_TRANSFER';
  walletState: WalletSessionState;
  securityState: ContractSecurityState;
  recordedTxs: RecordedContractTransaction[];
  onOpenConnectModal: () => void;
  onUpdateProfitRecipient: (newRecipient: string) => void;
  onRequestTxPreview: (preview: TransactionPreviewPayload) => void;
}

export const EmergencyRecoveryAndProfitView: React.FC<EmergencyRecoveryAndProfitViewProps> = ({
  initialMode,
  walletState,
  securityState,
  recordedTxs,
  onOpenConnectModal,
  onUpdateProfitRecipient,
  onRequestTxPreview,
}) => {
  const [activeTab, setActiveTab] = useState<'RECOVERY' | 'PROFIT_TRANSFER'>(initialMode);

  // Emergency Recovery State
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState('USDT');
  const [recoveryDestination, setRecoveryDestination] = useState(
    securityState.deployedOwnerAddress
  );
  const [recoveryAmount, setRecoveryAmount] = useState('142.50');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Profit Distribution State
  const [recipientInput, setRecipientInput] = useState(securityState.profitRecipientAddress);
  const [recipientBanner, setRecipientBanner] = useState<string | null>(null);
  const [profitTokenSymbol, setProfitTokenSymbol] = useState('USDT');
  const [grossOutputUsd, setGrossOutputUsd] = useState(25145.0);
  const [borrowedPrincipalUsd, setBorrowedPrincipalUsd] = useState(25000.0);
  const [flashLoanFeeUsd, setFlashLoanFeeUsd] = useState(12.5);
  const [dexFeesUsd, setDexFeesUsd] = useState(87.5);
  const [gasCostUsd, setGasCostUsd] = useState(15.31);
  const [relayBuilderFeeUsd, setRelayBuilderFeeUsd] = useState(0.0);
  const [minProfitThresholdUsd, setMinProfitThresholdUsd] = useState(10.0);
  const [profitTransferError, setProfitTransferError] = useState<string | null>(null);

  const isConnected = walletState.status === 'CONNECTED';
  const isOwnerVerified =
    isConnected &&
    Boolean(walletState.address) &&
    walletState.address!.toLowerCase() === securityState.deployedOwnerAddress.toLowerCase();

  const chainConfig =
    SUPPORTED_CHAINS[walletState.chainId || securityState.chainId] || SUPPORTED_CHAINS[1];

  const selectedHolding =
    securityState.contractHoldings.find((h) => h.symbol === selectedTokenSymbol) ||
    securityState.contractHoldings[0];

  const profitHolding =
    securityState.contractHoldings.find((h) => h.symbol === profitTokenSymbol) ||
    securityState.contractHoldings[0];

  // Integer-safe residual profit calculation (micro-USD scaled)
  const residualCalculation = useMemo(() => {
    const scale = 1_000_000n;
    const toBig = (n: number) => BigInt(Math.max(0, Math.round(n * 1_000_000)));
    const gross = toBig(grossOutputUsd);
    const principal = toBig(borrowedPrincipalUsd);
    const flashFee = toBig(flashLoanFeeUsd);
    const dexFees = toBig(dexFeesUsd);
    const gas = toBig(gasCostUsd);
    const relay = toBig(relayBuilderFeeUsd);

    const requiredRepayment = principal + flashFee;
    const postSwapAvailable = gross > dexFees ? gross - dexFees : 0n;
    const repaymentSatisfied = postSwapAvailable >= requiredRepayment;

    const totalCosts = flashFee + dexFees + gas + relay;
    const netResidualScaled = gross - principal - totalCosts;
    const netResidualUsd = Number(netResidualScaled) / Number(scale);

    const contractActualBalance = Number(profitHolding?.onChainContractBalance || '0');
    const transferableOnChain =
      repaymentSatisfied &&
      netResidualUsd >= minProfitThresholdUsd &&
      contractActualBalance >= netResidualUsd;

    return {
      repaymentSatisfied,
      requiredRepaymentUsd: Number(requiredRepayment) / Number(scale),
      totalCostsUsd: Number(totalCosts) / Number(scale),
      netResidualUsd,
      contractActualBalance,
      transferableOnChain,
    };
  }, [
    grossOutputUsd,
    borrowedPrincipalUsd,
    flashLoanFeeUsd,
    dexFeesUsd,
    gasCostUsd,
    relayBuilderFeeUsd,
    minProfitThresholdUsd,
    profitHolding,
  ]);

  const handlePreviewEmergencyRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    if (!isOwnerVerified) {
      setRecoveryError(
        'Unauthorized Caller: Only the verified contract.owner() wallet can execute emergencyRecoverToken.'
      );
      return;
    }

    const destCheck = validateEthereumAddress(recoveryDestination);
    if (!destCheck.valid || !destCheck.checksummed) {
      setRecoveryError(destCheck.error || 'Invalid recovery destination address.');
      return;
    }

    // Destination policy check: must be owner or verified profitRecipient
    const allowedDests = [
      securityState.deployedOwnerAddress.toLowerCase(),
      securityState.profitRecipientAddress.toLowerCase(),
    ];
    if (!allowedDests.includes(destCheck.checksummed.toLowerCase())) {
      setRecoveryError(
        'Security Policy Violation: Recovery destination is not on the contract authorizedRecoveryDestinations allowlist.'
      );
      return;
    }

    const reqAmt = Number(recoveryAmount);
    const availAmt = Number(selectedHolding.onChainContractBalance);
    if (!Number.isFinite(reqAmt) || reqAmt <= 0) {
      setRecoveryError('Recovery amount must be greater than zero.');
      return;
    }
    if (reqAmt > availAmt) {
      setRecoveryError(
        `Insufficient Contract Balance: Requested ${reqAmt.toFixed(2)} ${
          selectedHolding.symbol
        } exceeds verified on-chain contract balance (${availAmt.toFixed(2)} ${
          selectedHolding.symbol
        }).`
      );
      return;
    }

    onRequestTxPreview({
      idempotencyKey: `recover-${selectedHolding.symbol}-${Date.now()}`,
      title: `Emergency Asset Recovery (${selectedHolding.symbol})`,
      actionType: 'EMERGENCY_RECOVERY',
      chainId: chainConfig.chainId,
      chainName: chainConfig.name,
      contractAddress: securityState.contractAddress,
      methodSignature: 'emergencyRecoverToken(address token, address destination, uint256 amount)',
      tokenSymbol: selectedHolding.symbol,
      tokenAddress: selectedHolding.tokenAddress,
      amountFormatted: `${reqAmt.toFixed(2)} ${selectedHolding.symbol}`,
      recipientAddress: destCheck.checksummed,
      estimatedGasEth: '0.00142',
      estimatedGasUsd: '$3.69',
      securityNotes: [
        'Recovers assets held directly inside the designated FlashAIArbitrageExecutor smart contract.',
        'Protected by nonReentrant and whenNoActiveFlashLoan modifiers so recovery cannot bypass flash-loan repayment.',
        'Confirmed on-chain transfers cannot be reversed.',
      ],
    });
  };

  const handleSaveRecipient = () => {
    setRecipientBanner(null);
    setProfitTransferError(null);
    if (!isOwnerVerified) {
      setProfitTransferError('Only the verified contract owner can update profitRecipient.');
      return;
    }
    const check = validateEthereumAddress(recipientInput);
    if (!check.valid || !check.checksummed) {
      setProfitTransferError(check.error || 'Invalid recipient address.');
      return;
    }
    onUpdateProfitRecipient(check.checksummed);
    setRecipientBanner(`Verified checksummed profit recipient updated to ${check.checksummed}`);
  };

  const handlePreviewProfitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setProfitTransferError(null);

    if (!isOwnerVerified) {
      setProfitTransferError(
        'Unauthorized Caller: Only the verified contract.owner() wallet may initiate transferResidualProfit.'
      );
      return;
    }

    const check = validateEthereumAddress(securityState.profitRecipientAddress);
    if (!check.valid || !check.checksummed) {
      setProfitTransferError('Verified profit recipient address is invalid.');
      return;
    }

    if (!residualCalculation.repaymentSatisfied) {
      setProfitTransferError(
        'Flash-Loan Repayment Not Proven: Residual profit cannot be transferred unless principal + flash-loan fee repayment is satisfied.'
      );
      return;
    }

    if (residualCalculation.netResidualUsd < minProfitThresholdUsd) {
      setProfitTransferError(
        `Net residual profit ($${residualCalculation.netResidualUsd.toFixed(
          2
        )}) is below the minimum profit threshold ($${minProfitThresholdUsd.toFixed(2)}).`
      );
      return;
    }

    if (residualCalculation.netResidualUsd > residualCalculation.contractActualBalance) {
      setProfitTransferError(
        `Requested transfer ($${residualCalculation.netResidualUsd.toFixed(
          2
        )}) exceeds actual verified on-chain contract balance ($${residualCalculation.contractActualBalance.toFixed(
          2
        )}).`
      );
      return;
    }

    const deterministicIdempotencyKey = `profit-xfer-${profitHolding.symbol}-${residualCalculation.netResidualUsd.toFixed(
      2
    )}`;
    const alreadyExecuted = recordedTxs.some(
      (t) =>
        t.idempotencyKey === deterministicIdempotencyKey &&
        (t.status === 'CONFIRMED' || t.status === 'SUBMITTED')
    );

    if (alreadyExecuted) {
      setProfitTransferError(
        `Duplicate Transfer Blocked (${deterministicIdempotencyKey}): This residual profit batch has already been submitted or confirmed.`
      );
      return;
    }

    onRequestTxPreview({
      idempotencyKey: deterministicIdempotencyKey,
      title: `Transfer Residual Profit to Owner Recipient (${profitHolding.symbol})`,
      actionType: 'PROFIT_TRANSFER',
      chainId: chainConfig.chainId,
      chainName: chainConfig.name,
      contractAddress: securityState.contractAddress,
      methodSignature:
        'transferResidualProfit(bytes32 transferId, address token, uint256 amount)',
      tokenSymbol: profitHolding.symbol,
      tokenAddress: profitHolding.tokenAddress,
      amountFormatted: `${residualCalculation.netResidualUsd.toFixed(2)} ${profitHolding.symbol}`,
      recipientAddress: check.checksummed,
      estimatedGasEth: '0.00135',
      estimatedGasUsd: '$3.51',
      securityNotes: [
        `Flash-loan principal + fee ($${residualCalculation.requiredRepaymentUsd.toFixed(
          2
        )}) verified prior to calculating residual profit.`,
        `Protected by on-chain executedProfitTransfers[transferId] mapping against replay or duplicate withdrawal.`,
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher */}
      <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400 mb-1">
            OWNER-AUTHORIZED CONTRACT ASSET MANAGEMENT
          </div>
          <h2 className="text-2xl font-bold text-white font-display">
            Emergency Contract Recovery & Verified Profit Distribution
          </h2>
          <p className="text-sm text-slate-300 mt-1 max-w-3xl">
            Manage assets held inside your designated execution smart contract. Pausing and asset
            recovery are strictly separated, and actual on-chain contract balances are always
            distinguished from simulated database estimates.
          </p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-[#080F23] border border-slate-800 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('RECOVERY')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'RECOVERY'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Emergency Recovery
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PROFIT_TRANSFER')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'PROFIT_TRANSFER'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Profit Transfer to Owner
          </button>
        </div>
      </div>

      {activeTab === 'RECOVERY' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Columns: Emergency Recovery Form & Verification */}
          <form
            onSubmit={handlePreviewEmergencyRecovery}
            className="lg:col-span-7 bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Emergency Smart Contract Asset Recovery
              </h3>
              <span className="text-xs font-mono text-cyan-400">
                Chain ID: {chainConfig.chainId} ({chainConfig.name})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#080F23] border border-slate-800">
                <div className="text-slate-400">Verified Execution Contract</div>
                <div className="text-white font-semibold mt-1 truncate">
                  {securityState.contractAddress}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#080F23] border border-slate-800">
                <div className="text-slate-400">Verified Contract Owner</div>
                <div className="text-emerald-400 font-semibold mt-1 truncate">
                  {securityState.deployedOwnerAddress}
                </div>
              </div>
            </div>

            {/* Token & Balance Comparison Table (Actual On-Chain vs Simulated Estimate) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Select Contract Asset (Actual On-Chain Balance vs Simulated Estimate)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {securityState.contractHoldings.map((h) => {
                  const selected = h.symbol === selectedTokenSymbol;
                  return (
                    <button
                      type="button"
                      key={h.symbol}
                      onClick={() => {
                        setSelectedTokenSymbol(h.symbol);
                        setRecoveryAmount(h.onChainContractBalance);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        selected
                          ? 'bg-blue-600/15 border-cyan-400 text-white'
                          : 'bg-[#080F23] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center font-mono">
                        <span className="font-bold text-white">{h.symbol}</span>
                        <span className="text-[10px] text-emerald-400">On-Chain Verified</span>
                      </div>
                      <div className="text-sm font-bold font-mono tabular-nums text-white mt-1">
                        {h.onChainContractBalance} {h.symbol}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        Sim DB Est: {h.simulatedProfitEstimate} {h.symbol}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Authorized Recovery Destination (Allowlisted Owner/Vault)
                </label>
                <input
                  type="text"
                  value={recoveryDestination}
                  onChange={(e) => setRecoveryDestination(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-xs font-mono text-white"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Recovery Amount ({selectedHolding.symbol})</span>
                  <button
                    type="button"
                    onClick={() => setRecoveryAmount(selectedHolding.onChainContractBalance)}
                    className="text-cyan-400 hover:underline font-mono"
                  >
                    Max On-Chain: {selectedHolding.onChainContractBalance}
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={recoveryAmount}
                  onChange={(e) => setRecoveryAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-xs font-mono text-white"
                />
              </div>
            </div>

            {recoveryError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{recoveryError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-4 border-t border-slate-800">
              <div className="text-xs font-mono text-slate-400">
                Estimated Gas: <span className="text-white">0.00142 ETH (≈ $3.69)</span>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20"
              >
                <span>Preview Recovery Transaction</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Right 5 Columns: Security Policy & Non-Custodial Disclosures */}
          <div className="lg:col-span-5 bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <h3 className="text-base font-bold text-white font-display">
              Emergency Recovery Security Boundaries
            </h3>
            <ul className="space-y-2.5 text-slate-300 leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Strictly Contract-Scoped:</strong> Recovery only withdraws residual tokens
                  held inside your designated <code>FlashAIArbitrageExecutor</code> contract. Funds
                  in your external wallet can never be withdrawn by the bot.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Separated from Stop All Bots:</strong> Pressing Stop All Bots pauses
                  execution scheduling without automatically triggering a bulk withdrawal.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Flash-Loan Repayment Integrity:</strong> The{' '}
                  <code>whenNoActiveFlashLoan</code> lock prevents recovery from executing during an
                  active flash-loan callback or bypassing repayment obligations.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Irreversibility Notice:</strong> Once an on-chain transaction is confirmed
                  in a block, it cannot be reversed. Always verify the destination address in the
                  transaction preview modal.
                </span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        /* PROFIT TRANSFER TO OWNER WALLET MODULE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handlePreviewProfitTransfer}
            className="lg:col-span-7 bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Profit Distribution to Verified Owner Wallet
              </h3>
              <span className="text-xs font-mono text-emerald-400">
                Idempotent & Repayment-Gated
              </span>
            </div>

            {/* Verified Recipient Configuration */}
            <div className="p-4 rounded-xl bg-[#080F23] border border-slate-800 space-y-2.5">
              <label className="block text-xs font-semibold text-white">
                Verified Owner-Controlled Profit Recipient Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={handleSaveRecipient}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 whitespace-nowrap"
                >
                  Validate & Set Recipient
                </button>
              </div>
              {recipientBanner && (
                <div className="text-xs text-emerald-400 font-mono">{recipientBanner}</div>
              )}
            </div>

            {/* Interactive Residual Profit Accounting Inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Gross Trade Output ($)</label>
                <input
                  type="number"
                  step="1"
                  value={grossOutputUsd}
                  onChange={(e) => setGrossOutputUsd(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded bg-[#060B19] border border-slate-800 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Borrowed Principal ($)</label>
                <input
                  type="number"
                  step="100"
                  value={borrowedPrincipalUsd}
                  onChange={(e) => setBorrowedPrincipalUsd(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded bg-[#060B19] border border-slate-800 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Min Profit Threshold ($)</label>
                <input
                  type="number"
                  step="1"
                  value={minProfitThresholdUsd}
                  onChange={(e) => setMinProfitThresholdUsd(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded bg-[#060B19] border border-slate-800 font-mono text-emerald-400"
                />
              </div>
            </div>

            {profitTransferError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{profitTransferError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <div className="text-xs text-slate-400 font-mono">
                On-Chain Verified {profitHolding.symbol} in Contract:{' '}
                <span className="text-white font-bold">
                  {profitHolding.onChainContractBalance} {profitHolding.symbol}
                </span>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20"
              >
                <span>Preview Residual Profit Transfer</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Right 5 Columns: Deterministic Residual Profit Breakdown */}
          <div className="lg:col-span-5 bg-[#080F23] border border-slate-800 rounded-2xl p-6 space-y-4 text-xs font-mono tabular-nums">
            <h3 className="text-sm font-bold text-white font-sans">
              Integer-Safe Residual Profit Accounting
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Gross Swap Output:</span>
                <span className="text-white">${grossOutputUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>− Borrowed Principal:</span>
                <span className="text-slate-200">−${borrowedPrincipalUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>− Flash-Loan Fee (Aave V3):</span>
                <span className="text-rose-300">−${flashLoanFeeUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>− DEX Liquidity Fees:</span>
                <span className="text-rose-300">−${dexFeesUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>− Estimated L1 Gas Cost:</span>
                <span className="text-rose-300">−${gasCostUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>− Relay / Builder Payment:</span>
                <span className="text-rose-300">−${relayBuilderFeeUsd.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between">
                <span className="text-slate-300">Flash-Loan Repayment Proof:</span>
                <span
                  className={
                    residualCalculation.repaymentSatisfied
                      ? 'text-emerald-400 font-bold'
                      : 'text-rose-400 font-bold'
                  }
                >
                  {residualCalculation.repaymentSatisfied ? 'SATISFIED' : 'INSUFFICIENT'}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1">
                <span className="text-white">Residual Transferable Profit:</span>
                <span
                  className={
                    residualCalculation.netResidualUsd >= minProfitThresholdUsd
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }
                >
                  ${residualCalculation.netResidualUsd.toFixed(2)} {profitHolding.symbol}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
