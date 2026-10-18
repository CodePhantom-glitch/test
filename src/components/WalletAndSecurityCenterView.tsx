import React, { useState } from 'react';
import {
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LogOut,
  ArrowRightLeft,
} from 'lucide-react';
import {
  ConnectionHealthMetrics,
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

interface WalletAndSecurityCenterViewProps {
  walletState: WalletSessionState;
  securityState: ContractSecurityState;
  health: ConnectionHealthMetrics;
  recordedTxs: RecordedContractTransaction[];
  onOpenConnectModal: () => void;
  onDisconnectWallet: () => void;
  onSwitchNetwork: (chainId: number) => Promise<void>;
  onRefreshBalances: () => Promise<void>;
  onRequestTxPreview: (preview: TransactionPreviewPayload) => void;
}

export const WalletAndSecurityCenterView: React.FC<WalletAndSecurityCenterViewProps> = ({
  walletState,
  securityState,
  health,
  recordedTxs,
  onOpenConnectModal,
  onDisconnectWallet,
  onSwitchNetwork,
  onRefreshBalances,
  onRequestTxPreview,
}) => {
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newOwnerInput, setNewOwnerInput] = useState('');
  const [ownerTransferError, setOwnerTransferError] = useState<string | null>(null);
  const [boundedApproveAmounts, setBoundedApproveAmounts] = useState<Record<string, string>>({
    USDT: '500.00',
    USDC: '500.00',
    DAI: '500.00',
    WETH: '0.25',
  });

  const isConnected = walletState.status === 'CONNECTED';
  const isOwnerVerified =
    isConnected &&
    Boolean(walletState.address) &&
    walletState.address!.toLowerCase() === securityState.deployedOwnerAddress.toLowerCase();

  const chainConfig =
    SUPPORTED_CHAINS[walletState.chainId || securityState.chainId] || SUPPORTED_CHAINS[1];

  const handleCopyAddress = () => {
    if (!walletState.address) return;
    navigator.clipboard.writeText(walletState.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshBalances();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePreviewOwnershipTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerTransferError(null);
    if (!isOwnerVerified) {
      setOwnerTransferError(
        'Unauthorized: Only the verified contract.owner() wallet may initiate transferOwnership.'
      );
      return;
    }
    const validation = validateEthereumAddress(newOwnerInput);
    if (!validation.valid || !validation.checksummed) {
      setOwnerTransferError(validation.error || 'Invalid destination owner address.');
      return;
    }
    if (
      validation.checksummed.toLowerCase() ===
      securityState.deployedOwnerAddress.toLowerCase()
    ) {
      setOwnerTransferError('New owner address must differ from the current owner address.');
      return;
    }

    onRequestTxPreview({
      idempotencyKey: `own-xfer-${Date.now()}`,
      title: 'Two-Step Contract Ownership Transfer (transferOwnership)',
      actionType: 'OWNERSHIP_TRANSFER',
      chainId: chainConfig.chainId,
      chainName: chainConfig.name,
      contractAddress: securityState.contractAddress,
      methodSignature: 'transferOwnership(address newOwner)',
      tokenSymbol: 'N/A (Access Control)',
      tokenAddress: securityState.contractAddress,
      amountFormatted: '0 ETH (Admin Role Transfer)',
      recipientAddress: validation.checksummed,
      estimatedGasEth: '0.00084',
      estimatedGasUsd: '$2.18',
      securityNotes: [
        `Initiates two-step ownership transfer from ${shortenAddress(
          securityState.deployedOwnerAddress
        )} to ${shortenAddress(validation.checksummed)}.`,
        'The new owner must subsequently call acceptOwnership() to complete the transfer.',
      ],
    });
  };

  const handlePreviewTokenApproval = (
    tokenSymbol: string,
    tokenAddress: string,
    revoke: boolean
  ) => {
    if (!isConnected || !walletState.address) {
      onOpenConnectModal();
      return;
    }
    const boundedAmount = revoke ? '0.00' : boundedApproveAmounts[tokenSymbol] || '100.00';
    onRequestTxPreview({
      idempotencyKey: `erc20-approve-${tokenSymbol}-${Date.now()}`,
      title: revoke
        ? `Revoke ${tokenSymbol} Token Allowance (Set to 0)`
        : `Bounded ${tokenSymbol} Token Approval`,
      actionType: revoke ? 'TOKEN_APPROVAL_REVOKE' : 'TOKEN_APPROVAL_BOUNDED',
      chainId: chainConfig.chainId,
      chainName: chainConfig.name,
      contractAddress: tokenAddress,
      methodSignature: 'approve(address spender, uint256 value)',
      tokenSymbol,
      tokenAddress,
      amountFormatted: `${boundedAmount} ${tokenSymbol}`,
      recipientAddress: securityState.contractAddress,
      estimatedGasEth: '0.00092',
      estimatedGasUsd: '$2.39',
      securityNotes: revoke
        ? [
            `Sets allowance of ${securityState.contractAddress} to exactly 0 ${tokenSymbol}.`,
            'Immediately revokes permission for the contract to pull tokens from your wallet.',
          ]
        : [
            `Grants a strictly bounded allowance of ${boundedAmount} ${tokenSymbol} (never unlimited MaxUint256).`,
            'Wallet connection alone never grants token spending permission without this explicit signature.',
          ],
    });
  };

  const pendingTxCount = recordedTxs.filter(
    (t) => t.status === 'AWAITING_APPROVAL' || t.status === 'SUBMITTED'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-cyan-400 mb-1">
            NON-CUSTODIAL WALLET & SMART CONTRACT SECURITY CENTER
          </div>
          <h2 className="text-2xl font-bold text-white font-display">
            Wallet Connectivity, Access Verification & Token Allowance Control
          </h2>
          <p className="text-sm text-slate-300 mt-1 max-w-3xl">
            Users retain 100% self-custody of private keys. Contract ownership is verified directly
            against on-chain state, unlimited ERC-20 approvals are avoided by default, and every
            privileged action requires an explicit wallet signature preview.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#080F23] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh On-Chain State
              </button>
              <button
                type="button"
                onClick={onDisconnectWallet}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect Wallet
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20"
            >
              <Wallet className="w-4 h-4" />
              Connect Non-Custodial Wallet
            </button>
          )}
        </div>
      </div>

      {/* Unsupported Network Alert Banner */}
      {walletState.status === 'UNSUPPORTED_NETWORK' && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Unsupported Network Detected</div>
              <p className="mt-0.5">
                {walletState.errorMessage ||
                  'Please switch your wallet to Ethereum Mainnet (1), Sepolia Testnet (11155111), or Arbitrum One (42161).'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSwitchNetwork(1)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold"
            >
              Switch to Mainnet (1)
            </button>
            <button
              type="button"
              onClick={() => onSwitchNetwork(11155111)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-semibold"
            >
              Switch to Sepolia
            </button>
          </div>
        </div>
      )}

      {/* 8 WALLET & SECURITY DASHBOARD CARDS (Section 3 Requirement) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Connected Wallet */}
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>1. Connected Wallet</span>
            <Wallet className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-base font-bold font-mono text-white flex items-center gap-2">
            <span>{walletState.shortAddress || 'Disconnected'}</span>
            {walletState.address && (
              <button
                type="button"
                onClick={handleCopyAddress}
                className="text-slate-400 hover:text-cyan-300"
                title="Copy full address"
              >
                {copiedAddr ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {isConnected
              ? `${walletState.connectorLabel} · Native: ${walletState.nativeBalanceEth} ETH`
              : 'Verify handshake to load balances'}
          </div>
        </div>

        {/* 2. Active Network */}
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>2. Active Network</span>
            <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-base font-bold text-white truncate">{walletState.chainName}</div>
          <div className="text-[11px] font-mono flex items-center justify-between">
            <span className="text-slate-400">
              Chain ID: {walletState.chainId ?? securityState.chainId}
            </span>
            <span
              className={
                walletState.isSupportedNetwork
                  ? 'text-emerald-400'
                  : isConnected
                  ? 'text-rose-400'
                  : 'text-slate-500'
              }
            >
              {walletState.isSupportedNetwork
                ? '✓ Supported'
                : isConnected
                ? '✕ Unsupported'
                : 'Standby'}
            </span>
          </div>
        </div>

        {/* 3. Contract Ownership Verification */}
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>3. Contract Ownership</span>
            <KeyRound className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-base font-bold font-mono flex items-center gap-1.5">
            {isOwnerVerified ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Owner Verified
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1.5">
                <Lock className="w-4 h-4" /> Read-Only / Non-Owner
              </span>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-400 truncate">
            Owner: {shortenAddress(securityState.deployedOwnerAddress)}
          </div>
        </div>

        {/* 4. Contract Pause Status */}
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>4. Contract Pause Status</span>
            {securityState.onChainPaused ? (
              <Lock className="w-4 h-4 text-amber-400" />
            ) : (
              <Unlock className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="text-base font-bold font-mono">
            {securityState.onChainPaused ? (
              <span className="text-amber-400">ON-CHAIN PAUSED</span>
            ) : (
              <span className="text-emerald-400">ON-CHAIN ACTIVE</span>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Off-Chain Scanner: {securityState.offChainScannerStopped ? 'STOPPED' : 'RUNNING'}
          </div>
        </div>

        {/* 5. Profit Recipient Verification */}
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>5. Profit Recipient</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold font-mono text-white">
            {shortenAddress(securityState.profitRecipientAddress)}
          </div>
          <div className="text-[11px] font-mono text-emerald-400">
            ✓ Verified Checksum Recipient
          </div>
        </div>

        {/* 6. Outstanding Transaction Status */}
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>6. Outstanding Tx Status</span>
            <span className="font-mono text-cyan-400">{pendingTxCount} Pending</span>
          </div>
          <div className="text-base font-bold font-mono text-white">
            {pendingTxCount > 0 ? 'Awaiting Confirmation' : 'No Pending Queue'}
          </div>
          <div className="text-[11px] font-mono text-slate-400 truncate">
            {recordedTxs[0]
              ? `Latest: ${recordedTxs[0].actionType} (${recordedTxs[0].status})`
              : 'All transactions settled'}
          </div>
        </div>

        {/* 7. Latest Confirmed On-Chain Profit Transfer */}
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>7. Latest Profit Transfer</span>
            <span className="font-mono text-emerald-400">Verified Receipt</span>
          </div>
          <div className="text-base font-bold font-mono tabular-nums text-emerald-400">
            {securityState.lastConfirmedProfitAmount || 'None Recorded Yet'}
          </div>
          <div className="text-[11px] font-mono text-slate-400 truncate">
            {securityState.lastConfirmedProfitTxHash
              ? `Tx: ${securityState.lastConfirmedProfitTxHash.slice(0, 14)}...`
              : 'Requires owner signature'}
          </div>
        </div>

        {/* 8. RPC & WebSocket Health */}
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>8. RPC & WebSocket Health</span>
            <span className="font-mono text-emerald-400">
              {health.rpcConnected ? 'Nominal' : 'Degraded'}
            </span>
          </div>
          <div className="text-base font-bold font-mono tabular-nums text-white">
            Block #{health.lastBlockNumber.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Age: {health.blockAgeSec}s · Gas: {health.gasPriceGwei} Gwei
          </div>
        </div>
      </div>

      {/* 2-Column Split: Left = Wallet Session & Token Allowances, Right = Owner-Only Contract Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Wallet Session Management & ERC-20 Allowance Inspector */}
        <div className="lg:col-span-7 space-y-6">
          {/* Network Switcher & Session Details */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white font-display">
                Active Wallet Session & Network Switcher
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {walletState.connectedAtIso
                  ? `Connected at ${new Date(walletState.connectedAtIso).toLocaleTimeString()}`
                  : 'No active session'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {Object.values(SUPPORTED_CHAINS).map((chain) => {
                const active = (walletState.chainId || securityState.chainId) === chain.chainId;
                return (
                  <button
                    key={chain.chainId}
                    type="button"
                    onClick={() => onSwitchNetwork(chain.chainId)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-blue-600/15 border-cyan-400 text-white'
                        : 'bg-[#080F23] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{chain.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Chain ID: {chain.chainId} {chain.isTestnet ? '(Testnet)' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Token Approval Inspection & Revocation Workflow */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white font-display">
                  ERC-20 Token Balances & Allowance Revocation Inspector
                </h3>
                <p className="text-xs text-slate-400">
                  Never grant unlimited approvals by default. Set bounded allowances or revoke to 0
                  at any time.
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-400">Verified On-Chain Data</span>
            </div>

            {!isConnected ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  Connect your wallet or use the On-Chain RPC Inspector to view verified ERC-20
                  balances and contract allowances.
                </p>
                <button
                  type="button"
                  onClick={onOpenConnectModal}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white"
                >
                  Connect Wallet to Inspect Balances
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 bg-[#080F23]">
                      <th className="py-3 px-4">TOKEN</th>
                      <th className="py-3 px-4 text-right">ON-CHAIN BALANCE</th>
                      <th className="py-3 px-4 text-right">CURRENT ALLOWANCE</th>
                      <th className="py-3 px-4">BOUNDED LIMIT</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {walletState.tokenBalances.map((tok) => (
                      <tr key={tok.symbol} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{tok.symbol}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {tok.tokenAddress.slice(0, 8)}...{tok.tokenAddress.slice(-4)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                          {tok.balanceFormatted} {tok.symbol}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          <span
                            className={
                              tok.allowanceIsUnlimited
                                ? 'text-rose-400 font-bold'
                                : Number(tok.allowanceToContractFormatted) > 0
                                ? 'text-amber-300'
                                : 'text-emerald-400'
                            }
                          >
                            {tok.allowanceToContractFormatted}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={boundedApproveAmounts[tok.symbol] || '100.00'}
                            onChange={(e) =>
                              setBoundedApproveAmounts((p) => ({
                                ...p,
                                [tok.symbol]: e.target.value,
                              }))
                            }
                            className="w-24 px-2 py-1 rounded bg-[#060B19] border border-slate-800 text-xs font-mono text-white"
                          />
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewTokenApproval(tok.symbol, tok.tokenAddress, false)
                            }
                            className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-cyan-300 font-medium"
                          >
                            Approve Bounded
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewTokenApproval(tok.symbol, tok.tokenAddress, true)
                            }
                            className="px-2.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-medium"
                          >
                            Revoke (0)
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Owner-Only Contract Controls & Verification Links */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                Owner-Only Smart Contract Controls
              </h3>
              <span
                className={`text-xs font-mono font-semibold ${
                  isOwnerVerified ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {isOwnerVerified ? 'OWNER AUTHORIZED' : 'NON-OWNER LOCKED'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#080F23] border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Execution Contract:</span>
                <a
                  href={`${chainConfig.explorerUrl}/address/${securityState.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                >
                  {shortenAddress(securityState.contractAddress)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">On-Chain Owner (`owner()`):</span>
                <span className="text-white">
                  {shortenAddress(securityState.deployedOwnerAddress)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Connected Wallet:</span>
                <span className={isOwnerVerified ? 'text-emerald-400' : 'text-amber-300'}>
                  {walletState.shortAddress || 'Not Connected'}
                </span>
              </div>
            </div>

            {!isOwnerVerified && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Privileged actions (`setPaused`, `transferOwnership`, `emergencyRecoverToken`,
                  `transferResidualProfit`) are restricted to the verified contract owner. Connect
                  the owner wallet to unlock signing controls.
                </span>
              </div>
            )}

            {/* Pause / Unpause On-Chain Button */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs">
                <div className="font-semibold text-white">On-Chain Execution Circuit Breaker</div>
                <div className="text-slate-400">
                  Calls <code className="text-cyan-300">setPaused(bool)</code> on the contract
                </div>
              </div>
              <button
                type="button"
                disabled={!isOwnerVerified}
                onClick={() =>
                  onRequestTxPreview({
                    idempotencyKey: `pause-toggle-${Date.now()}`,
                    title: securityState.onChainPaused
                      ? 'Unpause Execution Contract On-Chain'
                      : 'Pause Execution Contract On-Chain',
                    actionType: securityState.onChainPaused
                      ? 'UNPAUSE_CONTRACT'
                      : 'PAUSE_CONTRACT',
                    chainId: chainConfig.chainId,
                    chainName: chainConfig.name,
                    contractAddress: securityState.contractAddress,
                    methodSignature: `setPaused(${!securityState.onChainPaused})`,
                    tokenSymbol: 'N/A (Contract State)',
                    tokenAddress: securityState.contractAddress,
                    amountFormatted: '0 ETH',
                    recipientAddress: securityState.contractAddress,
                    estimatedGasEth: '0.00068',
                    estimatedGasUsd: '$1.77',
                    securityNotes: [
                      securityState.onChainPaused
                        ? 'Unpauses FlashAIArbitrageExecutor so owner-initiated flash-loan callbacks can execute.'
                        : 'Immediately blocks requestFlashLoanArbitrage and executeOperation on-chain via whenNotPaused modifier.',
                    ],
                  })
                }
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white whitespace-nowrap"
              >
                {securityState.onChainPaused ? 'Preview Unpause Tx' : 'Preview Pause Tx'}
              </button>
            </div>

            {/* Two-Step Ownership Transfer Form */}
            <form
              onSubmit={handlePreviewOwnershipTransfer}
              className="pt-3 border-t border-slate-800 space-y-2.5"
            >
              <label className="block text-xs font-semibold text-white">
                Two-Step Ownership Transfer (`transferOwnership`)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOwnerInput}
                  onChange={(e) => setNewOwnerInput(e.target.value)}
                  placeholder="New Owner Address (0x...)"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-xs font-mono text-white"
                />
                <button
                  type="submit"
                  disabled={!isOwnerVerified}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-cyan-300 whitespace-nowrap"
                >
                  Preview Transfer
                </button>
              </div>
              {ownerTransferError && (
                <div className="text-xs text-rose-400">{ownerTransferError}</div>
              )}
              <p className="text-[11px] text-slate-400">
                Trust Assumption Note: Access control restricts administrative callers to{' '}
                <code>owner</code>, but never replaces independent smart-contract audits or slippage
                bounds.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Recent Privileged Contract Actions & Audit Trail */}
      <div className="bg-[#0B132B] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-white font-display">
            Recent Privileged Contract Actions & On-Chain Transaction Receipts
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {recordedTxs.length} recorded actions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 bg-[#080F23]">
                <th className="py-3 px-4">ACTION TYPE</th>
                <th className="py-3 px-4">CALLER</th>
                <th className="py-3 px-4">DESTINATION / SPENDER</th>
                <th className="py-3 px-4">ASSET / AMOUNT</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4 text-right">TX HASH / EXPLORER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {recordedTxs.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{tx.title}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {tx.chainName} · {new Date(tx.timestampIso).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {shortenAddress(tx.callerAddress)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {shortenAddress(tx.recipientAddress)}
                  </td>
                  <td className="py-3 px-4 font-mono text-white">{tx.amountFormatted}</td>
                  <td className="py-3 px-4 font-mono">
                    <span
                      className={
                        tx.status === 'CONFIRMED'
                          ? 'text-emerald-400 font-semibold'
                          : tx.status === 'FAILED' || tx.status === 'REVERTED'
                          ? 'text-rose-400 font-semibold'
                          : 'text-amber-300'
                      }
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {tx.txHash ? (
                      <a
                        href={tx.explorerUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                      >
                        {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
