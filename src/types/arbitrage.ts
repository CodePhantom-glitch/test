export type ExecutionMode = 'DEMO' | 'SIMULATION' | 'MONITORING' | 'LIVE_DISABLED';

export type StrategyKey =
  | 'classic'
  | 'mev-backrun'
  | 'multi-hop'
  | 'multi-chain'
  | 'stablecoin'
  | 'custom-ai';

export type RiskLevel = 'Low Risk' | 'Medium Risk' | 'Higher Risk' | 'Adjustable';

export interface StrategyConfig {
  id?: number;
  strategyKey: StrategyKey;
  name: string;
  tagline: string;
  badgeText: string;
  riskLevel: RiskLevel;
  categoryTag: string;
  network: string;
  dexList: string[];
  tokenPair: string;
  tokenDecimals: number;
  flashLoanProvider: string;
  flashLoanFeeBps: number;
  borrowAmountUsd: number;
  minBorrowUsd: number;
  maxBorrowUsd: number;
  routePath: string[];
  maxHops: number;
  minNetProfitUsd: number;
  minNetProfitPct: number;
  maxGasUsd: number;
  maxSlippageBps: number;
  maxPriceImpactBps: number;
  staleDataThresholdSec: number;
  simulationOnly: boolean;
  status: 'Running' | 'Paused' | 'Stopped';
  bulletPoints: string[];
  simulatedAprRange: string;
  recommendedCapitalRange: string;
  metricLeftLabel: string;
  metricLeftValue: string;
  metricLeftTone: 'positive' | 'warning' | 'danger' | 'info';
  metricRightLabel: string;
  metricRightValue: string;
  metricRightTone: 'positive' | 'neutral' | 'warning' | 'danger' | 'info';
  lastScanAgo: string;
  latestSimNetUsd: number;
}

export interface ProfitValidationInput {
  strategyName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  borrowAmountUsd: number;
  minBorrowUsd: number;
  maxBorrowUsd: number;
  grossSpreadBps: number;
  flashLoanFeeBps: number;
  dexFeeBpsTotal: number;
  priceImpactBps: number;
  maxPriceImpactBps: number;
  expectedSlippageBps: number;
  maxSlippageBps: number;
  gasLimitUnits: number;
  gasPriceGwei: number;
  ethPriceUsd: number;
  maxGasUsd: number;
  relayBuilderTipUsd: number;
  otherExecutionCostsUsd: number;
  hopCount: number;
  maxHops: number;
  snapshotAgeSec: number;
  staleDataThresholdSec: number;
  minNetProfitUsd: number;
  minNetProfitPct: number;
  swapReverted?: boolean;
  reentrancyDetected?: boolean;
  callbackAuthorized?: boolean;
  contractPaused?: boolean;
  routerApproved?: boolean;
  tokenSupported?: boolean;
  deductDexFeesInOutputQuote?: boolean;
}

export interface ProfitValidationBreakdown {
  accepted: boolean;
  statusStage: 'DETECTED' | 'SIMULATED_ACCEPTED' | 'SIMULATED_REJECTED';
  rejectionReasons: string[];
  borrowPrincipalUsd: number;
  borrowPrincipalTokenUnits: string;
  grossSpreadUsd: number;
  grossOutputBeforeCostsUsd: number;
  flashLoanFeeUsd: number;
  dexFeesUsd: number;
  priceImpactCostUsd: number;
  slippageCostUsd: number;
  gasCostUsd: number;
  relayBuilderTipUsd: number;
  otherExecutionCostsUsd: number;
  totalCostsUsd: number;
  finalOutputAfterSwapUsd: number;
  requiredRepaymentUsd: number;
  repaymentProven: boolean;
  netProfitUsd: number;
  profitMarginBps: number;
  profitMarginPct: number;
  confidenceLimitations: string[];
  calculationFormula: string;
}

export type ScenarioCaseType =
  | 'normal_profitable'
  | 'unprofitable_spread'
  | 'stale_data'
  | 'failed_swap'
  | 'insufficient_repayment'
  | 'excessive_gas'
  | 'reentrancy_blocked'
  | 'normal_scan';

export interface SimulatedOpportunityRecord {
  id: string;
  strategyKey: StrategyKey;
  strategyName: string;
  network: string;
  tokenPair: string;
  routeDescription: string;
  scenarioType: ScenarioCaseType;
  stage: 'Detected Opportunity' | 'Simulated Trade' | 'Rejected in Validation';
  timestampIso: string;
  timeAgo: string;
  poolLiquidityUsd: number;
  eventToDetectMs: number;
  detectToSimMs: number;
  simToSubmitMs: number;
  validation: ProfitValidationBreakdown;
}

export interface AutomatedTestCaseResult {
  id: string;
  name: string;
  scenarioType: string;
  category: 'PROFIT_ENGINE' | 'WALLET_AUTH' | 'CONTRACT_SECURITY' | 'RECOVERY_PROFIT';
  description: string;
  expectedOutcome: 'ACCEPT' | 'REJECT' | 'ENFORCED';
  actualOutcome: 'ACCEPT' | 'REJECT' | 'ENFORCED';
  passed: boolean;
  repaymentProven: boolean;
  netProfitUsd: number;
  primaryReason: string;
  executionTimeMs: number;
}

export interface ConnectionHealthMetrics {
  executionMode: ExecutionMode;
  rpcConnected: boolean;
  rpcProviderName: string;
  wsConnected: boolean;
  lastBlockNumber: number;
  blockAgeSec: number;
  gasPriceGwei: number;
  ethPriceUsd: number;
  eventToDetectMs: number;
  detectToSimMs: number;
  simToSubmitMs: number;
  activePoolSubscriptions: number;
  emergencyStopActive: boolean;
}

export interface PortfolioAsset {
  symbol: string;
  name: string;
  networkLabel: string;
  amount: number;
  valueUsd: number;
  change24hPct: number;
  colorHex: string;
}

// --- Web3 Wallet & Non-Custodial Security Interfaces ---
export type WalletConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'UNSUPPORTED_NETWORK'
  | 'REJECTED'
  | 'ERROR';

export type WalletConnectorType =
  | 'METAMASK_EXTENSION'
  | 'METAMASK_MOBILE'
  | 'WALLETCONNECT_REOWN'
  | 'INJECTED_EVM';

export interface OnChainTokenBalance {
  symbol: string;
  name: string;
  tokenAddress: string;
  decimals: number;
  balanceRaw: string;
  balanceFormatted: string;
  allowanceToContractFormatted: string;
  allowanceIsUnlimited: boolean;
  verifiedOnChain: boolean;
}

export interface WalletSessionState {
  status: WalletConnectionStatus;
  connectorType: WalletConnectorType | null;
  connectorLabel: string;
  address: string | null;
  shortAddress: string | null;
  chainId: number | null;
  chainName: string;
  isSupportedNetwork: boolean;
  nativeBalanceEth: string | null;
  tokenBalances: OnChainTokenBalance[];
  connectedAtIso: string | null;
  errorMessage: string | null;
}

export interface ContractSecurityState {
  chainId: number;
  chainName: string;
  contractAddress: string;
  deployedOwnerAddress: string;
  pendingOwnerAddress: string | null;
  profitRecipientAddress: string;
  isOwnerMatchedWithWallet: boolean;
  onChainPaused: boolean;
  offChainScannerStopped: boolean;
  queuedJobsCancelled: number;
  pendingBroadcastTxHash: string | null;
  lastConfirmedProfitTxHash: string | null;
  lastConfirmedProfitAmount: string | null;
  contractHoldings: Array<{
    symbol: string;
    name: string;
    tokenAddress: string;
    decimals: number;
    onChainContractBalance: string;
    simulatedProfitEstimate: string;
    minTransferThreshold: string;
  }>;
}

export type TxLifecycleStatus =
  | 'AWAITING_APPROVAL'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REVERTED';

export interface TransactionPreviewPayload {
  idempotencyKey: string;
  title: string;
  actionType:
    | 'PAUSE_CONTRACT'
    | 'UNPAUSE_CONTRACT'
    | 'OWNERSHIP_TRANSFER'
    | 'EMERGENCY_RECOVERY'
    | 'PROFIT_TRANSFER'
    | 'TOKEN_APPROVAL_BOUNDED'
    | 'TOKEN_APPROVAL_REVOKE';
  chainId: number;
  chainName: string;
  contractAddress: string;
  methodSignature: string;
  tokenSymbol: string;
  tokenAddress: string;
  amountFormatted: string;
  recipientAddress: string;
  estimatedGasEth: string;
  estimatedGasUsd: string;
  securityNotes: string[];
}

export interface RecordedContractTransaction {
  id: string;
  idempotencyKey: string;
  actionType: TransactionPreviewPayload['actionType'];
  title: string;
  chainId: number;
  chainName: string;
  contractAddress: string;
  callerAddress: string;
  recipientAddress: string;
  tokenSymbol: string;
  amountFormatted: string;
  txHash: string | null;
  status: TxLifecycleStatus;
  explorerUrl: string | null;
  timestampIso: string;
  notes: string;
}
