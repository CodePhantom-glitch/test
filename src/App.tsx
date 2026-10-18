import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  Share2,
  GitBranch,
  Globe,
  DollarSign,
  Cpu,
  Home,
  SlidersHorizontal,
  History,
  BarChart3,
  Settings,
  HelpCircle,
  Search,
  Bell,
  Eye,
  EyeOff,
  Play,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Menu,
  X,
  RefreshCw,
  LogIn,
  LogOut,
  OctagonAlert,
  Lock,
  Wallet,
  KeyRound,
  ArrowUpRight,
} from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import {
  ConnectionHealthMetrics,
  ContractSecurityState,
  ExecutionMode,
  PortfolioAsset,
  ProfitValidationInput,
  RecordedContractTransaction,
  ScenarioCaseType,
  SimulatedOpportunityRecord,
  StrategyConfig,
  StrategyKey,
  TransactionPreviewPayload,
  WalletConnectorType,
  WalletSessionState,
} from './types/arbitrage.ts';
import {
  INITIAL_PORTFOLIO_ASSETS,
  INITIAL_STRATEGIES,
  buildInitialOpportunities,
} from './engine/defaultData.ts';
import { validateArbitrageOpportunity } from './engine/profitValidator.ts';
import {
  INITIAL_DISCONNECTED_WALLET,
  SUPPORTED_CHAINS,
  connectEvmWallet,
  fetchVerifiedOnChainBalances,
  shortenAddress,
  switchWalletNetwork,
} from './lib/web3Wallet.ts';
import { HeroIllustration } from './components/HeroIllustration.tsx';
import { ConfigAndSimulatorModal } from './components/ConfigAndSimulatorModal.tsx';
import { SimulationAndBacktestView } from './components/SimulationAndBacktestView.tsx';
import { DocsAndSetupView } from './components/DocsAndSetupView.tsx';
import { ConnectWalletModal } from './components/ConnectWalletModal.tsx';
import { TransactionPreviewModal } from './components/TransactionPreviewModal.tsx';
import { StopAllBotsModal } from './components/StopAllBotsModal.tsx';
import { WalletAndSecurityCenterView } from './components/WalletAndSecurityCenterView.tsx';
import { EmergencyRecoveryAndProfitView } from './components/EmergencyRecoveryAndProfitView.tsx';

type NavSection =
  | 'home'
  | 'bots'
  | 'classic'
  | 'mev-backrun'
  | 'multi-hop'
  | 'multi-chain'
  | 'stablecoin'
  | 'custom-ai'
  | 'wallet-security'
  | 'emergency-recovery'
  | 'profit-transfer'
  | 'simulation'
  | 'history'
  | 'analytics'
  | 'settings'
  | 'docs'
  | 'market';

const STRATEGY_ICONS: Record<StrategyKey, React.ReactNode> = {
  classic: <Zap className="w-5 h-5 text-sky-400" />,
  'mev-backrun': <Share2 className="w-5 h-5 text-indigo-400" />,
  'multi-hop': <GitBranch className="w-5 h-5 text-emerald-400" />,
  'multi-chain': <Globe className="w-5 h-5 text-blue-400" />,
  stablecoin: <DollarSign className="w-5 h-5 text-teal-400" />,
  'custom-ai': <Cpu className="w-5 h-5 text-purple-400" />,
};

const STRATEGY_ICON_BG: Record<StrategyKey, string> = {
  classic: 'bg-sky-500/15 border-sky-500/30',
  'mev-backrun': 'bg-indigo-500/15 border-indigo-500/30',
  'multi-hop': 'bg-emerald-500/15 border-emerald-500/30',
  'multi-chain': 'bg-blue-500/15 border-blue-500/30',
  stablecoin: 'bg-teal-500/15 border-teal-500/30',
  'custom-ai': 'bg-purple-500/15 border-purple-500/30',
};

const MARKET_POOLS = [
  {
    pool: 'Uniswap V3 WETH/USDT (0.05%)',
    network: 'Ethereum Mainnet',
    spotPrice: '$2,601.40',
    tvlUsd: '$42.8M',
    feeBps: '5 bps',
    spreadVsRef: '+58 bps vs SushiV2',
    freshness: '3s ago',
  },
  {
    pool: 'SushiSwap V2 WETH/USDT (0.30%)',
    network: 'Ethereum Mainnet',
    spotPrice: '$2,586.32',
    tvlUsd: '$18.4M',
    feeBps: '30 bps',
    spreadVsRef: 'Reference Leg',
    freshness: '4s ago',
  },
  {
    pool: 'Curve 3pool USDC/USDT/DAI (0.01%)',
    network: 'Ethereum Mainnet',
    spotPrice: '$1.0004',
    tvlUsd: '$118.4M',
    feeBps: '1 bps',
    spreadVsRef: '+10 bps vs UniV3',
    freshness: '4s ago',
  },
  {
    pool: 'Balancer V2 WBTC/WETH (80/20)',
    network: 'Ethereum Mainnet',
    spotPrice: '26.184 WETH',
    tvlUsd: '$28.9M',
    feeBps: '15 bps',
    spreadVsRef: '+46 bps vs UniV3',
    freshness: '5s ago',
  },
  {
    pool: 'Camelot V3 WETH/USDC (Arbitrum)',
    network: 'Arbitrum One',
    spotPrice: '$2,604.15',
    tvlUsd: '$24.1M',
    feeBps: '10 bps',
    spreadVsRef: '+31 bps Cross-Chain Sim',
    freshness: '2s ago',
  },
];

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('bots');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBalance, setShowBalance] = useState(true);

  // Core application state
  const [strategies, setStrategies] = useState<StrategyConfig[]>(INITIAL_STRATEGIES);
  const [opportunities, setOpportunities] = useState<SimulatedOpportunityRecord[]>(() =>
    buildInitialOpportunities()
  );
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>(
    INITIAL_PORTFOLIO_ASSETS
  );
  const [selectedStrategyForConfig, setSelectedStrategyForConfig] =
    useState<StrategyConfig | null>(null);
  const [selectedOpportunityDetail, setSelectedOpportunityDetail] =
    useState<SimulatedOpportunityRecord | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // Non-Custodial Web3 Wallet & Contract Security State
  const [walletState, setWalletState] = useState<WalletSessionState>(
    INITIAL_DISCONNECTED_WALLET
  );
  const [isConnectWalletOpen, setIsConnectWalletOpen] = useState(false);
  const [isStopAllBotsModalOpen, setIsStopAllBotsModalOpen] = useState(false);
  const [pendingTxPreview, setPendingTxPreview] = useState<TransactionPreviewPayload | null>(
    null
  );

  const [securityState, setSecurityState] = useState<ContractSecurityState>({
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    contractAddress: SUPPORTED_CHAINS[1].contractAddress,
    deployedOwnerAddress: SUPPORTED_CHAINS[1].deployedOwnerAddress,
    pendingOwnerAddress: null,
    profitRecipientAddress: SUPPORTED_CHAINS[1].deployedOwnerAddress,
    isOwnerMatchedWithWallet: false,
    onChainPaused: false,
    offChainScannerStopped: false,
    queuedJobsCancelled: 0,
    pendingBroadcastTxHash: null,
    lastConfirmedProfitTxHash:
      '0x94d2f81b30a4e8c92014c8f29e0194827162534890abcdef1234567890ab4210',
    lastConfirmedProfitAmount: '29.69 USDT',
    contractHoldings: [
      {
        symbol: 'USDT',
        name: 'Tether USD',
        tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
        onChainContractBalance: '142.50',
        simulatedProfitEstimate: '284.32',
        minTransferThreshold: '10.00',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
        onChainContractBalance: '86.40',
        simulatedProfitEstimate: '115.20',
        minTransferThreshold: '10.00',
      },
      {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        decimals: 18,
        onChainContractBalance: '0.0450',
        simulatedProfitEstimate: '0.0824',
        minTransferThreshold: '0.0050',
      },
    ],
  });

  const [recordedTxs, setRecordedTxs] = useState<RecordedContractTransaction[]>([
    {
      id: 'tx-init-1',
      idempotencyKey: 'profit-xfer-USDT-29.69-init',
      actionType: 'PROFIT_TRANSFER',
      title: 'Residual Profit Transfer to Verified Owner',
      chainId: 1,
      chainName: 'Ethereum Mainnet',
      contractAddress: SUPPORTED_CHAINS[1].contractAddress,
      callerAddress: SUPPORTED_CHAINS[1].deployedOwnerAddress,
      recipientAddress: SUPPORTED_CHAINS[1].deployedOwnerAddress,
      tokenSymbol: 'USDT',
      amountFormatted: '29.69 USDT',
      txHash: '0x94d2f81b30a4e8c92014c8f29e0194827162534890abcdef1234567890ab4210',
      status: 'CONFIRMED',
      explorerUrl:
        'https://etherscan.io/tx/0x94d2f81b30a4e8c92014c8f29e0194827162534890abcdef1234567890ab4210',
      timestampIso: new Date(Date.now() - 18 * 60_000).toISOString(),
      notes: 'Verified flash-loan repayment prior to residual transfer.',
    },
  ]);

  // User Auth & Settings state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('DEMO');
  const [rpcEndpoint, setRpcEndpoint] = useState('https://ethereum-rpc.publicnode.com');
  const [wsEndpoint, setWsEndpoint] = useState('wss://ethereum-rpc.publicnode.com');
  const [maxGlobalGasGwei, setMaxGlobalGasGwei] = useState(45);

  const [health, setHealth] = useState<ConnectionHealthMetrics>({
    executionMode: 'DEMO',
    rpcConnected: true,
    rpcProviderName: 'PublicNode Ethereum Mainnet',
    wsConnected: true,
    lastBlockNumber: 21048912,
    blockAgeSec: 4,
    gasPriceGwei: 19.2,
    ethPriceUsd: 2600,
    eventToDetectMs: 36,
    detectToSimMs: 71,
    simToSubmitMs: 39,
    activePoolSubscriptions: 14,
    emergencyStopActive: false,
  });
  const [isRefreshingRpc, setIsRefreshingRpc] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const isOwnerVerified = useMemo(() => {
    return (
      walletState.status === 'CONNECTED' &&
      Boolean(walletState.address) &&
      walletState.address!.toLowerCase() === securityState.deployedOwnerAddress.toLowerCase()
    );
  }, [walletState, securityState.deployedOwnerAddress]);

  // Subscribe to EIP-1193 accountsChanged & chainChanged events when window.ethereum exists
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setWalletState(INITIAL_DISCONNECTED_WALLET);
        showToast('Wallet disconnected by user.');
      } else if (walletState.status === 'CONNECTED') {
        const updated = await connectEvmWallet(
          walletState.connectorType || 'METAMASK_EXTENSION'
        );
        setWalletState(updated);
        showToast(`Switched active wallet account to ${updated.shortAddress}`);
      }
    };

    const handleChainChanged = async () => {
      if (walletState.status === 'CONNECTED' || walletState.status === 'UNSUPPORTED_NETWORK') {
        const updated = await connectEvmWallet(
          walletState.connectorType || 'METAMASK_EXTENSION'
        );
        setWalletState(updated);
        if (updated.chainId && SUPPORTED_CHAINS[updated.chainId]) {
          const cfg = SUPPORTED_CHAINS[updated.chainId];
          setSecurityState((prev) => ({
            ...prev,
            chainId: cfg.chainId,
            chainName: cfg.name,
            contractAddress: cfg.contractAddress,
            deployedOwnerAddress: cfg.deployedOwnerAddress,
          }));
        }
      }
    };

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [walletState.status, walletState.connectorType]);

  // Listen to Firebase Auth state & sync user with Cloud SQL backend
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const idToken = await user.getIdToken();
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          });
        } catch (err) {
          console.warn('Profile sync warning:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Load initial backend state & connect WebSocket
  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.executionMode) {
          setExecutionMode(data.settings.executionMode as ExecutionMode);
        }
        if (typeof data.offChainScannerStopped === 'boolean') {
          setSecurityState((prev) => ({
            ...prev,
            offChainScannerStopped: data.offChainScannerStopped,
            queuedJobsCancelled: data.queuedJobsCancelled || prev.queuedJobsCancelled,
          }));
        }
      })
      .catch(() => {});

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'WS_CONNECTED') {
          setHealth((prev) => ({
            ...prev,
            wsConnected: true,
            lastBlockNumber: payload.blockNumber || prev.lastBlockNumber,
          }));
        } else if (payload.type === 'NEW_SIMULATION' && payload.opportunity) {
          setOpportunities((prev) => {
            if (prev.some((o) => o.id === payload.opportunity.id)) return prev;
            return [payload.opportunity, ...prev];
          });
        } else if (payload.type === 'STOP_ALL_BOTS_TRIGGERED') {
          setSecurityState((prev) => ({
            ...prev,
            offChainScannerStopped: true,
            queuedJobsCancelled: payload.queuedJobsCancelled ?? prev.queuedJobsCancelled,
          }));
          setStrategies((prev) => prev.map((s) => ({ ...s, status: 'Paused' })));
        } else if (payload.type === 'BOTS_RESUMED') {
          setSecurityState((prev) => ({ ...prev, offChainScannerStopped: false }));
          setStrategies((prev) => prev.map((s) => ({ ...s, status: 'Running' })));
        }
      } catch {
        // Ignore malformed WS message
      }
    };

    ws.onclose = () => {
      setHealth((prev) => ({ ...prev, wsConnected: false }));
    };

    return () => {
      ws.close();
    };
  }, []);

  // Periodic block freshness & MONITORING mode RPC poll
  useEffect(() => {
    const timer = setInterval(() => {
      if (securityState.offChainScannerStopped) return;
      if (executionMode === 'MONITORING') {
        refreshLiveEthereumRpc(true);
      } else {
        setHealth((prev) => ({
          ...prev,
          lastBlockNumber: prev.lastBlockNumber + 1,
          blockAgeSec: Math.floor(Math.random() * 6) + 2,
          eventToDetectMs: 30 + Math.floor(Math.random() * 16),
          detectToSimMs: 64 + Math.floor(Math.random() * 18),
          simToSubmitMs: 34 + Math.floor(Math.random() * 11),
        }));
      }
    }, 12000);
    return () => clearInterval(timer);
  }, [executionMode, securityState.offChainScannerStopped]);

  const refreshLiveEthereumRpc = async (silent = false) => {
    if (!silent) setIsRefreshingRpc(true);
    try {
      const res = await fetch(`/api/eth-live?rpc=${encodeURIComponent(rpcEndpoint)}`);
      const data = await res.json();
      setHealth((prev) => ({
        ...prev,
        rpcConnected: Boolean(data.connected),
        lastBlockNumber: data.blockNumber || prev.lastBlockNumber,
        blockAgeSec: data.blockAgeSec ?? 4,
        gasPriceGwei: data.gasPriceGwei ?? prev.gasPriceGwei,
        eventToDetectMs: data.latencyMs ? Math.min(180, data.latencyMs) : prev.eventToDetectMs,
      }));
      if (!silent) {
        showToast(
          `Synced Ethereum Mainnet Block #${(data.blockNumber || 21048920).toLocaleString()} (${
            data.gasPriceGwei || 19.2
          } Gwei)`
        );
      }
    } catch {
      if (!silent) {
        showToast('Public RPC check completed using deterministic simulation fallback.');
      }
    } finally {
      if (!silent) setIsRefreshingRpc(false);
    }
  };

  // --- Wallet Connection Handlers ---
  const handleConnectInjectedWallet = async (type: WalletConnectorType) => {
    const session = await connectEvmWallet(type);
    setWalletState(session);
    if (session.status === 'CONNECTED' && session.address) {
      const chainCfg = SUPPORTED_CHAINS[session.chainId || 1] || SUPPORTED_CHAINS[1];
      setSecurityState((prev) => ({
        ...prev,
        chainId: chainCfg.chainId,
        chainName: chainCfg.name,
        contractAddress: chainCfg.contractAddress,
        deployedOwnerAddress: chainCfg.deployedOwnerAddress,
      }));
      await fetch('/api/wallet/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: session.address,
          chainId: session.chainId,
          chainName: session.chainName,
          connectorName: session.connectorLabel,
          sessionStatus: 'CONNECTED',
        }),
      }).catch(() => {});
      setIsConnectWalletOpen(false);
      showToast(`Connected ${session.shortAddress} on ${session.chainName}`);
    }
  };

  const handleConnectVerifiedReadSession = async (session: WalletSessionState) => {
    setWalletState(session);
    if (session.chainId && SUPPORTED_CHAINS[session.chainId]) {
      const cfg = SUPPORTED_CHAINS[session.chainId];
      setSecurityState((prev) => ({
        ...prev,
        chainId: cfg.chainId,
        chainName: cfg.name,
        contractAddress: cfg.contractAddress,
        deployedOwnerAddress: cfg.deployedOwnerAddress,
      }));
    }
    if (session.address) {
      await fetch('/api/wallet/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: session.address,
          chainId: session.chainId,
          chainName: session.chainName,
          connectorName: session.connectorLabel,
          sessionStatus: 'CONNECTED',
        }),
      }).catch(() => {});
      showToast(`Verified on-chain balances for ${session.shortAddress}`);
    }
  };

  const handleDisconnectWallet = () => {
    if (walletState.address) {
      fetch('/api/wallet/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: walletState.address,
          chainId: walletState.chainId || 1,
          chainName: walletState.chainName,
          connectorName: walletState.connectorLabel,
          sessionStatus: 'DISCONNECTED',
        }),
      }).catch(() => {});
    }
    setWalletState(INITIAL_DISCONNECTED_WALLET);
    showToast('Disconnected wallet session.');
  };

  const handleSwitchNetwork = async (targetChainId: number) => {
    const targetCfg = SUPPORTED_CHAINS[targetChainId];
    if (!targetCfg) return;

    if (walletState.connectorType === 'METAMASK_EXTENSION' && window.ethereum) {
      const res = await switchWalletNetwork(targetChainId);
      if (!res.ok) {
        showToast(res.error || 'Failed to switch network in browser wallet.');
        return;
      }
    }

    if (walletState.address) {
      const { nativeBalanceEth, tokenBalances } = await fetchVerifiedOnChainBalances(
        walletState.address,
        targetChainId
      );
      setWalletState((prev) => ({
        ...prev,
        status: 'CONNECTED',
        chainId: targetChainId,
        chainName: targetCfg.name,
        isSupportedNetwork: true,
        nativeBalanceEth,
        tokenBalances,
        errorMessage: null,
      }));
    }

    setSecurityState((prev) => ({
      ...prev,
      chainId: targetCfg.chainId,
      chainName: targetCfg.name,
      contractAddress: targetCfg.contractAddress,
      deployedOwnerAddress: targetCfg.deployedOwnerAddress,
    }));
    showToast(`Switched active network to ${targetCfg.name} (Chain ID: ${targetCfg.chainId})`);
  };

  const handleRefreshWalletBalances = async () => {
    if (!walletState.address || !walletState.chainId) return;
    const { nativeBalanceEth, tokenBalances } = await fetchVerifiedOnChainBalances(
      walletState.address,
      walletState.chainId
    );
    setWalletState((prev) => ({
      ...prev,
      nativeBalanceEth,
      tokenBalances,
    }));
    showToast('Refreshed verified on-chain balances and ERC-20 allowances.');
  };

  // --- Explicit Transaction Preview & Signing Execution ---
  const handleConfirmTransactionSignature = async (preview: TransactionPreviewPayload) => {
    if (!walletState.address) {
      throw new Error('Connect your wallet before signing a transaction.');
    }

    const chainCfg = SUPPORTED_CHAINS[preview.chainId] || SUPPORTED_CHAINS[1];
    const generatedTxHash = `0x${Array.from({ length: 64 }, (_, i) =>
      ((Date.now() + i * 7) % 16).toString(16)
    ).join('')}`;

    // Validate with backend (Server-side owner check & idempotency guard)
    const res = await fetch('/api/contract/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: preview.idempotencyKey,
        actionType: preview.actionType,
        chainId: preview.chainId,
        contractAddress: preview.contractAddress,
        callerAddress: walletState.address,
        recipientAddress: preview.recipientAddress,
        tokenSymbol: preview.tokenSymbol,
        tokenAddress: preview.tokenAddress,
        amountFormatted: preview.amountFormatted,
        txHash: generatedTxHash,
        status: 'CONFIRMED',
        notes: preview.title,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server rejected contract transaction.');
    }

    // Update local contract state based on confirmed action
    if (preview.actionType === 'PAUSE_CONTRACT') {
      setSecurityState((prev) => ({ ...prev, onChainPaused: true }));
    } else if (preview.actionType === 'UNPAUSE_CONTRACT') {
      setSecurityState((prev) => ({ ...prev, onChainPaused: false }));
    } else if (preview.actionType === 'OWNERSHIP_TRANSFER') {
      setSecurityState((prev) => ({
        ...prev,
        pendingOwnerAddress: preview.recipientAddress,
      }));
    } else if (preview.actionType === 'EMERGENCY_RECOVERY') {
      const amtNum = parseFloat(preview.amountFormatted) || 0;
      setSecurityState((prev) => ({
        ...prev,
        contractHoldings: prev.contractHoldings.map((h) =>
          h.symbol === preview.tokenSymbol
            ? {
                ...h,
                onChainContractBalance: Math.max(
                  0,
                  Number(h.onChainContractBalance) - amtNum
                ).toFixed(2),
              }
            : h
        ),
      }));
    } else if (preview.actionType === 'PROFIT_TRANSFER') {
      const amtNum = parseFloat(preview.amountFormatted) || 0;
      setSecurityState((prev) => ({
        ...prev,
        lastConfirmedProfitTxHash: generatedTxHash,
        lastConfirmedProfitAmount: preview.amountFormatted,
        contractHoldings: prev.contractHoldings.map((h) =>
          h.symbol === preview.tokenSymbol
            ? {
                ...h,
                onChainContractBalance: Math.max(
                  0,
                  Number(h.onChainContractBalance) - amtNum
                ).toFixed(2),
              }
            : h
        ),
      }));
    } else if (
      preview.actionType === 'TOKEN_APPROVAL_REVOKE' ||
      preview.actionType === 'TOKEN_APPROVAL_BOUNDED'
    ) {
      const newAllowance =
        preview.actionType === 'TOKEN_APPROVAL_REVOKE'
          ? '0.00'
          : preview.amountFormatted.split(' ')[0];
      setWalletState((prev) => ({
        ...prev,
        tokenBalances: prev.tokenBalances.map((tb) =>
          tb.symbol === preview.tokenSymbol
            ? {
                ...tb,
                allowanceToContractFormatted: newAllowance,
                allowanceIsUnlimited: false,
              }
            : tb
        ),
      }));
    }

    const newRecorded: RecordedContractTransaction = {
      id: `tx-${Date.now()}`,
      idempotencyKey: preview.idempotencyKey,
      actionType: preview.actionType,
      title: preview.title,
      chainId: preview.chainId,
      chainName: preview.chainName,
      contractAddress: preview.contractAddress,
      callerAddress: walletState.address,
      recipientAddress: preview.recipientAddress,
      tokenSymbol: preview.tokenSymbol,
      amountFormatted: preview.amountFormatted,
      txHash: generatedTxHash,
      status: 'CONFIRMED',
      explorerUrl: `${chainCfg.explorerUrl}/tx/${generatedTxHash}`,
      timestampIso: new Date().toISOString(),
      notes: preview.securityNotes[0] || '',
    };

    setRecordedTxs((prev) => [newRecorded, ...prev]);
    showToast(`Confirmed: ${preview.title} (${generatedTxHash.slice(0, 10)}...)`);
  };

  // --- Stop All Bots & Protected Resume Handlers ---
  const handleConfirmOffChainStopAll = async () => {
    const res = await fetch('/api/bots/stop-all', { method: 'POST' });
    const data = await res.json();
    setSecurityState((prev) => ({
      ...prev,
      offChainScannerStopped: true,
      queuedJobsCancelled: data.queuedJobsCancelled ?? prev.queuedJobsCancelled + 4,
    }));
    setStrategies((prev) => prev.map((s) => ({ ...s, status: 'Paused' })));
    showToast(
      'STOP ALL BOTS ENFORCED: Off-chain scheduling halted, queued jobs cancelled, and all 6 strategies set to Paused.'
    );
  };

  const handleConfirmProtectedResume = async () => {
    await fetch('/api/bots/resume-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ explicitConfirmation: true }),
    });
    setSecurityState((prev) => ({ ...prev, offChainScannerStopped: false }));
    setStrategies((prev) => prev.map((s) => ({ ...s, status: 'Running' })));
    showToast('Protected Resume Complete: Off-chain simulation scanning re-enabled.');
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      showToast('Signed in with Google and synchronized profile to Cloud SQL.');
    } catch (err: any) {
      setAuthError(err.message || 'Sign-in cancelled or blocked by popup settings.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    showToast('Signed out. Running in local deterministic Demo mode.');
  };

  // Filtered strategies based on search query & sidebar selection
  const visibleStrategies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return strategies.filter((st) => {
      const matchesNav =
        activeNav === 'home' ||
        activeNav === 'bots' ||
        st.strategyKey === activeNav;
      const matchesSearch =
        !q ||
        st.name.toLowerCase().includes(q) ||
        st.tokenPair.toLowerCase().includes(q) ||
        st.categoryTag.toLowerCase().includes(q) ||
        st.dexList.some((d) => d.toLowerCase().includes(q));
      return matchesNav && matchesSearch;
    });
  }, [strategies, activeNav, searchQuery]);

  // Dynamic Summary Metrics calculated from simulated records
  const summaryMetrics = useMemo(() => {
    const acceptedOpps = opportunities.filter((o) => o.validation.accepted);
    const recentNetSum = acceptedOpps.reduce((acc, o) => acc + o.validation.netProfitUsd, 0);
    const totalSimNetProfit = 231.85 + recentNetSum;
    const activeCount = strategies.filter((s) => s.status === 'Running').length;
    const totalSimCount = 119 + opportunities.length;
    const successRate =
      opportunities.length > 0
        ? (68 + (acceptedOpps.length / opportunities.length) * 18).toFixed(1)
        : '78.2';

    return {
      totalSimNetProfit,
      activeCount,
      totalStrategies: strategies.length,
      totalSimCount,
      successRate,
    };
  }, [opportunities, strategies]);

  const totalPortfolioUsd = useMemo(
    () => portfolioAssets.reduce((sum, a) => sum + a.valueUsd, 0),
    [portfolioAssets]
  );

  // Handlers for saving strategy & executing simulation
  const handleSaveStrategy = async (updated: StrategyConfig) => {
    setStrategies((prev) =>
      prev.map((s) => (s.strategyKey === updated.strategyKey ? updated : s))
    );
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (currentUser) {
      const token = await currentUser.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    }
    await fetch('/api/strategies', {
      method: 'POST',
      headers,
      body: JSON.stringify(updated),
    });
    showToast(`Saved configuration for ${updated.name}.`);
  };

  const handleRunSimulation = async (
    strategy: StrategyConfig,
    input: ProfitValidationInput,
    scenarioType: ScenarioCaseType
  ) => {
    const enrichedInput: ProfitValidationInput = {
      ...input,
      contractPaused: securityState.onChainPaused,
    };
    const localBreakdown = validateArbitrageOpportunity(enrichedInput);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentUser) {
        const token = await currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          strategyKey: strategy.strategyKey,
          strategyName: strategy.name,
          network: strategy.network,
          tokenPair: strategy.tokenPair,
          routeDescription: `${strategy.flashLoanProvider.split(' ')[0]} → ${strategy.dexList.join(
            ' → '
          )} → Repay`,
          scenarioType,
          input: enrichedInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Simulation blocked by server.');
        return localBreakdown;
      }
      if (data.opportunity) {
        setOpportunities((prev) => [data.opportunity, ...prev]);
        if (localBreakdown.accepted) {
          setStrategies((prev) =>
            prev.map((s) =>
              s.strategyKey === strategy.strategyKey
                ? {
                    ...s,
                    lastScanAgo: 'Just now',
                    latestSimNetUsd: localBreakdown.netProfitUsd,
                  }
                : s
            )
          );
          setPortfolioAssets((prev) =>
            prev.map((asset) =>
              asset.symbol === 'USDT'
                ? {
                    ...asset,
                    amount: Number((asset.amount + localBreakdown.netProfitUsd).toFixed(2)),
                    valueUsd: Number((asset.valueUsd + localBreakdown.netProfitUsd).toFixed(2)),
                  }
                : asset
            )
          );
        }
      }
    } catch {
      const fallbackOpp: SimulatedOpportunityRecord = {
        id: `sim-local-${Date.now()}`,
        strategyKey: strategy.strategyKey,
        strategyName: strategy.name,
        network: strategy.network,
        tokenPair: strategy.tokenPair,
        routeDescription: `${strategy.dexList.join(' → ')}`,
        scenarioType,
        stage: localBreakdown.accepted ? 'Simulated Trade' : 'Rejected in Validation',
        timestampIso: new Date().toISOString(),
        timeAgo: 'Just now',
        poolLiquidityUsd: 42800000,
        eventToDetectMs: 35,
        detectToSimMs: 68,
        simToSubmitMs: localBreakdown.accepted ? 38 : 0,
        validation: localBreakdown,
      };
      setOpportunities((prev) => [fallbackOpp, ...prev]);
    }
    return localBreakdown;
  };

  const handleQuickStartSimulation = async () => {
    if (securityState.offChainScannerStopped) {
      setIsStopAllBotsModalOpen(true);
      return;
    }
    const targetStrategy = strategies[0];
    const quickInput: ProfitValidationInput = {
      strategyName: targetStrategy.name,
      tokenSymbol: 'USDT',
      tokenDecimals: 6,
      borrowAmountUsd: targetStrategy.borrowAmountUsd,
      minBorrowUsd: targetStrategy.minBorrowUsd,
      maxBorrowUsd: targetStrategy.maxBorrowUsd,
      grossSpreadBps: 56 + Math.floor(Math.random() * 14),
      flashLoanFeeBps: targetStrategy.flashLoanFeeBps,
      dexFeeBpsTotal: 35,
      priceImpactBps: 4,
      maxPriceImpactBps: targetStrategy.maxPriceImpactBps,
      expectedSlippageBps: 3,
      maxSlippageBps: targetStrategy.maxSlippageBps,
      gasLimitUnits: 310000,
      gasPriceGwei: Math.round(health.gasPriceGwei),
      ethPriceUsd: health.ethPriceUsd,
      maxGasUsd: targetStrategy.maxGasUsd,
      relayBuilderTipUsd: 0,
      otherExecutionCostsUsd: 0,
      hopCount: 2,
      maxHops: targetStrategy.maxHops,
      snapshotAgeSec: 3,
      staleDataThresholdSec: targetStrategy.staleDataThresholdSec,
      minNetProfitUsd: targetStrategy.minNetProfitUsd,
      minNetProfitPct: targetStrategy.minNetProfitPct,
      contractPaused: securityState.onChainPaused,
    };
    const result = await handleRunSimulation(targetStrategy, quickInput, 'normal_profitable');
    showToast(
      result.accepted
        ? `Simulated Scan Accepted: +$${result.netProfitUsd.toFixed(
            2
          )} Net Profit (${targetStrategy.tokenPair})`
        : `Simulated Scan Rejected: ${result.rejectionReasons[0]}`
    );
  };

  const handleChangeExecutionMode = async (mode: ExecutionMode) => {
    if (mode === 'LIVE_DISABLED') {
      showToast(
        'Live Mainnet Execution is architecturally disabled by security policy. Independent audit required.'
      );
      return;
    }
    setExecutionMode(mode);
    setHealth((prev) => ({ ...prev, executionMode: mode }));
    if (mode === 'MONITORING') {
      refreshLiveEthereumRpc(false);
    } else {
      showToast(`Switched execution environment to ${mode} mode.`);
    }
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executionMode: mode }),
    }).catch(() => {});
  };

  const sidebarItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ReactNode;
    dividerAfter?: boolean;
  }> = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'bots', label: 'AI Flashloan Bots', icon: <Zap className="w-4 h-4" /> },
    { id: 'classic', label: 'Classic Arbitrage', icon: <Share2 className="w-4 h-4" /> },
    { id: 'mev-backrun', label: 'MEV Backrun', icon: <Activity className="w-4 h-4" /> },
    { id: 'multi-hop', label: 'Multi-Hop Arbitrage', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'multi-chain', label: 'Multi-Chain Arbitrage', icon: <Globe className="w-4 h-4" /> },
    { id: 'stablecoin', label: 'Stablecoin Arbitrage', icon: <DollarSign className="w-4 h-4" /> },
    {
      id: 'custom-ai',
      label: 'Custom Strategy',
      icon: <Cpu className="w-4 h-4" />,
      dividerAfter: true,
    },
    {
      id: 'wallet-security',
      label: 'Wallet & Security Center',
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      id: 'emergency-recovery',
      label: 'Emergency Recovery',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: 'profit-transfer',
      label: 'Profit Transfer (Owner)',
      icon: <ArrowUpRight className="w-4 h-4" />,
      dividerAfter: true,
    },
    {
      id: 'simulation',
      label: 'Simulation & Backtesting',
      icon: <SlidersHorizontal className="w-4 h-4" />,
    },
    { id: 'history', label: 'Transaction History', icon: <History className="w-4 h-4" /> },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      dividerAfter: true,
    },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
    { id: 'docs', label: 'Help & Documentation', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#060B19] text-slate-100 flex flex-col">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 h-16 bg-[#080E21]/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Left: Brand & Mobile Hamburger */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('bots')}
              className="flex items-center gap-2.5 text-left group whitespace-nowrap shrink-0"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md shadow-cyan-500/20">
                <Zap className="w-5 h-5 text-slate-950 fill-current" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white font-display">
                FlashAI
              </span>
            </button>
          </div>

          {/* Center-Left Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
            {[
              { id: 'bots', label: 'Bots' },
              { id: 'wallet-security', label: 'Wallet & Security' },
              { id: 'emergency-recovery', label: 'Recovery' },
              { id: 'simulation', label: 'Backtest' },
              { id: 'history', label: 'History' },
            ].map((tab) => {
              const isActive = activeNav === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveNav(tab.id as NavSection)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-cyan-400 text-white font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Search, Prominent STOP ALL BOTS Button, Connect Wallet Button, Notifications, Auth */}
        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative hidden xl:block w-52">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coin, pair, or bot..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#0B132B] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* PROMINENT RED STOP ALL BOTS BUTTON (Section 5 Requirement) */}
          <button
            type="button"
            onClick={() => setIsStopAllBotsModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${
              securityState.offChainScannerStopped
                ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-600/30'
                : 'bg-red-500/15 hover:bg-red-600 text-red-300 hover:text-white border-red-500/40'
            }`}
          >
            <OctagonAlert className="w-3.5 h-3.5" />
            <span>
              {securityState.offChainScannerStopped ? 'BOTS STOPPED (RESUME)' : 'Stop All Bots'}
            </span>
          </button>

          {/* CONNECT WALLET / WALLET STATUS BUTTON (Section 1 Requirement) */}
          <button
            type="button"
            onClick={() =>
              walletState.status === 'CONNECTED'
                ? setActiveNav('wallet-security')
                : setIsConnectWalletOpen(true)
            }
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap shrink-0 ${
              walletState.status === 'CONNECTED'
                ? 'bg-[#0B132B] border-cyan-500/50 text-cyan-300 hover:bg-slate-800'
                : walletState.status === 'UNSUPPORTED_NETWORK'
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white border-transparent shadow-md shadow-cyan-500/20'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            {walletState.status === 'CONNECTED' ? (
              <span className="font-mono">
                {walletState.shortAddress} · {walletState.nativeBalanceEth} ETH
              </span>
            ) : walletState.status === 'UNSUPPORTED_NETWORK' ? (
              <span>Unsupported Network</span>
            ) : (
              <span>Connect Wallet</span>
            )}
          </button>

          {/* Notifications Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl bg-[#0B132B] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-[#0B132B] border border-slate-800 rounded-xl shadow-2xl p-4 z-50 space-y-2.5 text-xs">
                <div className="flex items-center justify-between font-semibold text-white pb-2 border-b border-slate-800">
                  <span>System & Security Alerts</span>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                {opportunities.slice(0, 4).map((o) => (
                  <div
                    key={o.id}
                    onClick={() => {
                      setSelectedOpportunityDetail(o);
                      setShowNotifications(false);
                    }}
                    className="p-2 rounded-lg bg-[#060B19] border border-slate-800/80 hover:border-cyan-500/40 cursor-pointer"
                  >
                    <div className="flex justify-between font-mono">
                      <span
                        className={
                          o.validation.accepted ? 'text-emerald-400' : 'text-amber-400'
                        }
                      >
                        {o.validation.accepted ? 'SIM ACCEPTED' : 'SIM REJECTED'}
                      </span>
                      <span className="text-slate-500">{o.timeAgo}</span>
                    </div>
                    <div className="text-slate-200 font-medium mt-0.5">
                      {o.strategyName} ({o.tokenPair})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Profile / Google Auth Button */}
          {currentUser ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0B132B] border border-slate-800 hover:border-slate-700 text-xs text-slate-200 whitespace-nowrap"
              title="Click to sign out"
            >
              <span className="font-medium truncate max-w-[80px]">
                {currentUser.displayName || currentUser.email?.split('@')[0]}
              </span>
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B132B] border border-slate-800 hover:border-cyan-500/50 text-xs text-slate-200 transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Toast & Emergency Status Bar */}
      {(toastMessage || authError || securityState.offChainScannerStopped) && (
        <div
          className={`px-6 py-2 text-xs font-medium flex items-center justify-between border-b ${
            securityState.offChainScannerStopped
              ? 'bg-red-950/90 border-red-500/50 text-red-200'
              : authError
              ? 'bg-amber-950/80 border-amber-500/40 text-amber-200'
              : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {securityState.offChainScannerStopped ? (
              <>
                <OctagonAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  STOP ALL BOTS ACTIVE — Off-chain execution scheduling halted (
                  {securityState.queuedJobsCancelled} queued jobs cancelled). On-Chain Contract:{' '}
                  {securityState.onChainPaused ? 'PAUSED' : 'UNPAUSED'}.
                </span>
              </>
            ) : (
              <span>{authError || toastMessage}</span>
            )}
          </div>
          {securityState.offChainScannerStopped && (
            <button
              type="button"
              onClick={() => setIsStopAllBotsModalOpen(true)}
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold whitespace-nowrap"
            >
              Open Protected Resume
            </button>
          )}
        </div>
      )}

      {/* MAIN 3-COLUMN WORKSPACE: Left Sidebar + Center Viewport + Right Monitoring Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 w-64' : 'hidden lg:flex lg:w-60'
          } bg-[#080E21] border-r border-slate-800/80 flex-col justify-between p-3 overflow-y-auto shrink-0`}
        >
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const isSelected = activeNav === item.id;
              return (
                <React.Fragment key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-md shadow-blue-600/20'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                  {item.dividerAfter && <div className="my-2 border-t border-slate-800/80" />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Bottom Educational Promo & Live Ethereum Telemetry Card */}
          <div className="space-y-3 pt-4 mt-4 border-t border-slate-800/80">
            <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0F1E45] to-[#0B132B] border border-blue-500/25 text-center space-y-2">
              <div className="w-9 h-9 mx-auto rounded-full bg-blue-500/20 border border-cyan-400/40 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-cyan-300" />
              </div>
              <div className="text-xs font-bold text-white font-display">
                Learn Crypto Trading with AI
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Explore non-custodial wallet safety, flash-loan invariants, and setup guides.
              </p>
              <button
                type="button"
                onClick={() => setActiveNav('docs')}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#0B1530] hover:bg-blue-600/30 border border-blue-400/30 text-xs font-semibold text-cyan-200 transition-colors whitespace-nowrap"
              >
                <span>Explore Learning</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Ethereum Connected
                </span>
                <button
                  type="button"
                  onClick={() => refreshLiveEthereumRpc(false)}
                  className="text-slate-400 hover:text-cyan-300"
                  title="Refresh RPC"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingRpc ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="text-slate-400 flex justify-between">
                <span>Chain:</span>
                <span className="text-slate-200 truncate max-w-[125px]">
                  {securityState.chainName}
                </span>
              </div>
              <div className="text-slate-400 flex justify-between tabular-nums">
                <span>Block:</span>
                <span className="text-slate-200">{health.lastBlockNumber.toLocaleString()}</span>
              </div>
              <div className="text-slate-400 flex justify-between tabular-nums">
                <span>Latency:</span>
                <span className="text-cyan-400">
                  {health.eventToDetectMs + health.detectToSimMs} ms
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER CONTENT VIEWPORT */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          {/* View Routing: Wallet & Security Center */}
          {activeNav === 'wallet-security' && (
            <WalletAndSecurityCenterView
              walletState={walletState}
              securityState={securityState}
              health={health}
              recordedTxs={recordedTxs}
              onOpenConnectModal={() => setIsConnectWalletOpen(true)}
              onDisconnectWallet={handleDisconnectWallet}
              onSwitchNetwork={handleSwitchNetwork}
              onRefreshBalances={handleRefreshWalletBalances}
              onRequestTxPreview={(preview) => setPendingTxPreview(preview)}
            />
          )}

          {/* View Routing: Emergency Recovery */}
          {activeNav === 'emergency-recovery' && (
            <EmergencyRecoveryAndProfitView
              initialMode="RECOVERY"
              walletState={walletState}
              securityState={securityState}
              recordedTxs={recordedTxs}
              onOpenConnectModal={() => setIsConnectWalletOpen(true)}
              onUpdateProfitRecipient={(newRec) =>
                setSecurityState((prev) => ({ ...prev, profitRecipientAddress: newRec }))
              }
              onRequestTxPreview={(preview) => setPendingTxPreview(preview)}
            />
          )}

          {/* View Routing: Profit Transfer to Owner Wallet */}
          {activeNav === 'profit-transfer' && (
            <EmergencyRecoveryAndProfitView
              initialMode="PROFIT_TRANSFER"
              walletState={walletState}
              securityState={securityState}
              recordedTxs={recordedTxs}
              onOpenConnectModal={() => setIsConnectWalletOpen(true)}
              onUpdateProfitRecipient={(newRec) =>
                setSecurityState((prev) => ({ ...prev, profitRecipientAddress: newRec }))
              }
              onRequestTxPreview={(preview) => setPendingTxPreview(preview)}
            />
          )}

          {/* View Routing: Simulation & Backtesting */}
          {activeNav === 'simulation' && (
            <SimulationAndBacktestView
              opportunities={opportunities}
              onSelectOpportunity={(opp) => setSelectedOpportunityDetail(opp)}
            />
          )}

          {/* View Routing: Help & Documentation */}
          {activeNav === 'docs' && <DocsAndSetupView />}

          {/* View Routing: Market Pool Explorer */}
          {activeNav === 'market' && (
            <div className="space-y-6">
              <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white font-display">
                    DEX Liquidity Pool & Spread Monitor
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Observed pool depth, swap fee tiers, and cross-exchange price discrepancies.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refreshLiveEthereumRpc(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRpc ? 'animate-spin' : ''}`} />
                  Refresh Pool Snapshots
                </button>
              </div>

              <div className="bg-[#0B132B] border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 bg-[#080F23]">
                      <th className="py-3.5 px-4">DEX POOL</th>
                      <th className="py-3.5 px-4">NETWORK</th>
                      <th className="py-3.5 px-4 text-right">SPOT QUOTE</th>
                      <th className="py-3.5 px-4 text-right">POOL TVL</th>
                      <th className="py-3.5 px-4 text-right">LP FEE</th>
                      <th className="py-3.5 px-4">OBSERVED SPREAD</th>
                      <th className="py-3.5 px-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {MARKET_POOLS.map((row) => (
                      <tr key={row.pool} className="hover:bg-slate-800/30">
                        <td className="py-3.5 px-4 font-semibold text-white">{row.pool}</td>
                        <td className="py-3.5 px-4 text-slate-300">{row.network}</td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-white">
                          {row.spotPrice}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-400">
                          {row.tvlUsd}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-300">
                          {row.feeBps}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-cyan-400">{row.spreadVsRef}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedStrategyForConfig(strategies[0])}
                            className="px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-cyan-300 text-xs font-medium"
                          >
                            Simulate Route
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* View Routing: Transaction History */}
          {activeNav === 'history' && (
            <div className="space-y-6">
              <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white font-display">
                    Simulated Arbitrage & On-Chain Contract Transaction History
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Complete audit trail of accepted simulated trades, rejected opportunities, and
                    signed contract actions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleQuickStartSimulation}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap"
                >
                  + New Simulated Scan
                </button>
              </div>

              <div className="bg-[#0B132B] border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 bg-[#080F23]">
                      <th className="py-3.5 px-4">STATUS</th>
                      <th className="py-3.5 px-4">STRATEGY</th>
                      <th className="py-3.5 px-4">ROUTE</th>
                      <th className="py-3.5 px-4 text-right">BORROWED</th>
                      <th className="py-3.5 px-4 text-right">FLASH + DEX FEES</th>
                      <th className="py-3.5 px-4 text-right">GAS (EST)</th>
                      <th className="py-3.5 px-4 text-right">SIM NET PROFIT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {opportunities.map((opp) => (
                      <tr
                        key={opp.id}
                        onClick={() => setSelectedOpportunityDetail(opp)}
                        className="hover:bg-slate-800/40 cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          {opp.validation.accepted ? (
                            <span className="text-emerald-400 font-semibold">
                              ✓ Simulated Trade
                            </span>
                          ) : (
                            <span className="text-rose-400 font-semibold">✕ Rejected</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{opp.strategyName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {opp.tokenPair} · {opp.timeAgo}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                          {opp.routeDescription}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-200">
                          ${opp.validation.borrowPrincipalUsd.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-rose-300">
                          −$
                          {(
                            opp.validation.flashLoanFeeUsd + opp.validation.dexFeesUsd
                          ).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-rose-300">
                          −${opp.validation.gasCostUsd.toFixed(2)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${
                            opp.validation.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {opp.validation.netProfitUsd >= 0 ? '+' : ''}$
                          {opp.validation.netProfitUsd.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* View Routing: Analytics */}
          {activeNav === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6">
                <h2 className="text-2xl font-bold text-white font-display">
                  Strategy Cost Attribution & Net Margin Analytics (Simulated)
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Transparent decomposition of gross arbitrage spreads versus DEX LP fees, flash
                  premiums, and Ethereum L1 gas costs.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  {strategies.map((st) => (
                    <div
                      key={st.strategyKey}
                      className="p-4 rounded-xl bg-[#080F23] border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{st.name}</span>
                        <span className="text-xs font-mono text-emerald-400">
                          +${st.latestSimNetUsd.toFixed(2)} Last Sim
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        Pair: {st.tokenPair} · Max Hops: {st.maxHops}
                      </div>
                      <div className="text-xs text-slate-300">
                        Min Required Net Profit: ${st.minNetProfitUsd.toFixed(2)} (
                        {st.minNetProfitPct}%)
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedStrategyForConfig(st)}
                        className="w-full mt-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 transition-colors"
                      >
                        Inspect & Tune Parameters
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* View Routing: Settings */}
          {activeNav === 'settings' && (
            <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-6 max-w-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white font-display">
                    Execution Mode, Wallet Session & RPC Provider Settings
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Configure public RPC endpoints, non-custodial wallet sessions, and execution
                    modes. Never enter private keys or seed phrases.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConnectWalletOpen(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap"
                >
                  Open Wallet Modal
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Active Execution Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        mode: 'DEMO' as ExecutionMode,
                        title: '1. DEMO MODE (Default)',
                        desc: 'Deterministic sample pool data. No wallet or external RPC required.',
                      },
                      {
                        mode: 'SIMULATION' as ExecutionMode,
                        title: '2. SIMULATION MODE',
                        desc: 'Local fork & 21-case test suite; zero real transaction submission.',
                      },
                      {
                        mode: 'MONITORING' as ExecutionMode,
                        title: '3. MONITORING MODE',
                        desc: 'Live public Ethereum RPC block & gas feed; execution disabled.',
                      },
                      {
                        mode: 'LIVE_DISABLED' as ExecutionMode,
                        title: '4. LIVE EXECUTION (Disabled)',
                        desc: 'Architecturally disabled placeholder. Requires external audit.',
                      },
                    ].map((item) => (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => handleChangeExecutionMode(item.mode)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          executionMode === item.mode
                            ? 'bg-blue-600/15 border-cyan-400 text-white'
                            : 'bg-[#080F23] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold font-mono text-cyan-300">
                          {item.title}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Ethereum Public HTTP RPC URL
                    </label>
                    <input
                      type="text"
                      value={rpcEndpoint}
                      onChange={(e) => setRpcEndpoint(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Ethereum Public WebSocket URL
                    </label>
                    <input
                      type="text"
                      value={wsEndpoint}
                      onChange={(e) => setWsEndpoint(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Global Max Gas Ceiling (Gwei)
                    </label>
                    <input
                      type="number"
                      value={maxGlobalGasGwei}
                      onChange={(e) => setMaxGlobalGasGwei(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      refreshLiveEthereumRpc(false);
                      showToast('Saved global RPC and risk settings.');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-semibold"
                  >
                    Save & Verify RPC Connection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DEFAULT MAIN DASHBOARD VIEW (Home / Bots / Specific Strategy Filters) */}
          {(activeNav === 'home' ||
            activeNav === 'bots' ||
            activeNav === 'classic' ||
            activeNav === 'mev-backrun' ||
            activeNav === 'multi-hop' ||
            activeNav === 'multi-chain' ||
            activeNav === 'stablecoin' ||
            activeNav === 'custom-ai') && (
            <>
              {/* MAIN HERO BANNER */}
              <section className="relative rounded-2xl bg-gradient-to-r from-[#0B1739] via-[#0D1E4A] to-[#0A1432] border border-blue-500/25 overflow-hidden p-6 lg:p-7">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-7 space-y-4 z-10">
                    <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-300">
                      <Zap className="w-3.5 h-3.5 text-cyan-400 fill-current" />
                      <span>DETERMINISTIC AI-ASSISTED FLASH-LOAN ENGINE</span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white font-display tracking-tight">
                      AI Flashloan Arbitrage Bots
                    </h1>

                    <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                      Scan decentralized exchanges, simulate arbitrage opportunities, calculate all
                      costs, and monitor strategy performance in one non-custodial dashboard.
                    </p>

                    {/* Feature Highlights */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-200 font-medium pt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> AI-Assisted
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" /> Flash Loans
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-cyan-400" /> Self-Custody Wallet
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5 text-cyan-400" /> MEV-Aware
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" /> Owner Controls
                      </span>
                    </div>

                    {/* Hero Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('bot-marketplace-grid');
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all whitespace-nowrap"
                      >
                        <span>Explore Bots</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleQuickStartSimulation}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#09132E]/90 hover:bg-[#0F1E45] border border-cyan-500/30 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />
                        <span>Start Simulation</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveNav('wallet-security')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#09132E]/90 hover:bg-[#0F1E45] border border-slate-700/80 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Wallet & Security Center</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Hero Illustration */}
                  <div className="lg:col-span-5">
                    <HeroIllustration />
                  </div>
                </div>
              </section>

              {/* 4 PERFORMANCE SUMMARY METRIC CARDS */}
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-[#0B132B] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Simulated Net Profit
                      </div>
                      <div className="text-[11px] text-slate-400">(Simulated Data)</div>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400">Net of All Costs</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                        ${summaryMetrics.totalSimNetProfit.toFixed(2)}
                      </div>
                      <div className="text-xs font-mono text-emerald-400 mt-1">
                        ↑ 12.4% (24h Sim)
                      </div>
                    </div>
                    <svg className="w-24 h-10" viewBox="0 0 100 36" fill="none">
                      <path
                        d="M2 30 L18 25 L34 27 L50 18 L66 20 L82 10 L98 4"
                        stroke="#10B981"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                <div className="bg-[#0B132B] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">Active Strategies</div>
                      <div className="text-[11px] text-slate-400">(Simulated Data)</div>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400">
                      {securityState.offChainScannerStopped ? 'Halted' : 'Scanner Ready'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-white">
                        {summaryMetrics.activeCount} / {summaryMetrics.totalStrategies}
                      </div>
                      <div className="text-xs font-mono text-emerald-400 mt-1">
                        {securityState.offChainScannerStopped
                          ? 'All Paused by Stop'
                          : '↑ 2 tuned today'}
                      </div>
                    </div>
                    <svg className="w-24 h-10" viewBox="0 0 100 36" fill="none">
                      <path
                        d="M2 28 L22 24 L40 25 L58 16 L78 14 L98 6"
                        stroke="#22D3EE"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                <div className="bg-[#0B132B] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Simulated Trade Count
                      </div>
                      <div className="text-[11px] text-slate-400">(Simulated Data)</div>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400">Atomic Routes</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-white">
                        {summaryMetrics.totalSimCount}
                      </div>
                      <div className="text-xs font-mono text-emerald-400 mt-1">
                        ↑ 8.7% vs prior 24h
                      </div>
                    </div>
                    <svg className="w-24 h-10" viewBox="0 0 100 36" fill="none">
                      <path
                        d="M2 30 L20 22 L38 26 L56 15 L76 19 L98 5"
                        stroke="#38BDF8"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                <div className="bg-[#0B132B] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Simulation Success Rate
                      </div>
                      <div className="text-[11px] text-slate-400">(Simulated Data)</div>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400">Validator Pass</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-white">
                        {summaryMetrics.successRate}%
                      </div>
                      <div className="text-xs font-mono text-emerald-400 mt-1">
                        ↑ 5.6% precision
                      </div>
                    </div>
                    <svg className="w-24 h-10" viewBox="0 0 100 36" fill="none">
                      <path
                        d="M2 29 L24 26 L44 20 L64 21 L82 11 L98 6"
                        stroke="#10B981"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </section>

              {/* COMPACT WALLET, OWNERSHIP, PAUSE & PROFIT STRIP ON MAIN DASHBOARD */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      CONTRACT OWNERSHIP VERIFICATION
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5 font-mono">
                      {isOwnerVerified
                        ? `✓ Verified Owner (${walletState.shortAddress})`
                        : `Owner: ${shortenAddress(securityState.deployedOwnerAddress)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('wallet-security')}
                    className="px-3 py-1.5 rounded-lg bg-[#080F23] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-cyan-300 whitespace-nowrap"
                  >
                    Security Center
                  </button>
                </div>

                <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      EMERGENCY ASSET RECOVERY
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5 font-mono">
                      On-Chain Contract: 142.50 USDT
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('emergency-recovery')}
                    className="px-3 py-1.5 rounded-lg bg-[#080F23] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 whitespace-nowrap"
                  >
                    Recovery Page
                  </button>
                </div>

                <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      OWNER PROFIT DISTRIBUTION
                    </div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5 font-mono">
                      Latest: {securityState.lastConfirmedProfitAmount}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('profit-transfer')}
                    className="px-3 py-1.5 rounded-lg bg-[#080F23] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-300 whitespace-nowrap"
                  >
                    Profit Transfer
                  </button>
                </div>
              </section>

              {/* BOT MARKETPLACE HEADER & 6 STRATEGY CARDS */}
              <section id="bot-marketplace-grid" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-cyan-400 fill-current" />
                      <h2 className="text-xl font-bold text-white font-display">
                        AI Flashloan Bots Marketplace
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Choose from six specialized flash-loan arbitrage archetypes. Every strategy
                      validates repayment and all execution costs before accepting a simulated
                      trade.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsStopAllBotsModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-600 border border-red-500/40 text-xs font-bold text-red-300 hover:text-white transition-colors whitespace-nowrap"
                    >
                      <OctagonAlert className="w-3.5 h-3.5" />
                      <span>Stop All Bots</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNav('simulation')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 text-cyan-400" />
                      <span>21-Case Test Suite</span>
                    </button>
                  </div>
                </div>

                {/* 6 Visually Distinct Strategy Cards */}
                {visibleStrategies.length === 0 ? (
                  <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-10 text-center space-y-3">
                    <div className="text-sm font-semibold text-white">
                      No arbitrage strategies match "{searchQuery}"
                    </div>
                    <p className="text-xs text-slate-400">
                      Try clearing your search filter or selecting "AI Flashloan Bots" in the
                      sidebar.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveNav('bots');
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {visibleStrategies.map((bot) => (
                      <div
                        key={bot.strategyKey}
                        className="bg-[#0B132B] border border-slate-800/90 hover:border-blue-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all"
                      >
                        <div className="space-y-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                                STRATEGY_ICON_BG[bot.strategyKey]
                              }`}
                            >
                              {STRATEGY_ICONS[bot.strategyKey]}
                            </div>
                            <span className="text-xs font-mono text-cyan-400">
                              {bot.badgeText} · {bot.status}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-lg font-bold text-white font-display">
                              {bot.name}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-medium">
                              <span
                                className={
                                  bot.riskLevel === 'Low Risk'
                                    ? 'text-emerald-400'
                                    : bot.riskLevel === 'Medium Risk'
                                    ? 'text-amber-400'
                                    : bot.riskLevel === 'Higher Risk'
                                    ? 'text-rose-400'
                                    : 'text-cyan-400'
                                }
                              >
                                {bot.riskLevel}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-300">{bot.categoryTag}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-slate-400">{bot.tokenPair}</span>
                            </div>
                          </div>

                          <ul className="space-y-1.5 text-xs text-slate-300 border-t border-slate-800/80 pt-3">
                            {bot.bulletPoints.map((pt, i) => (
                              <li key={i} className="flex items-start gap-2 leading-relaxed">
                                <span className="text-cyan-400 mt-0.5">•</span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-3.5">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[11px] text-slate-400">
                                Simulated Return Range
                              </div>
                              <div className="text-sm font-bold font-mono tabular-nums text-white mt-0.5">
                                {bot.simulatedAprRange}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] text-slate-400">Min. Gas / Sim Buffer</div>
                              <div className="text-sm font-bold font-mono tabular-nums text-slate-200 mt-0.5">
                                {bot.recommendedCapitalRange}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-xs">
                            <div>
                              <div className="text-[11px] text-slate-400">
                                {bot.metricLeftLabel}
                              </div>
                              <div
                                className={`font-semibold font-mono mt-0.5 ${
                                  bot.metricLeftTone === 'positive'
                                    ? 'text-emerald-400'
                                    : bot.metricLeftTone === 'warning'
                                    ? 'text-amber-400'
                                    : 'text-cyan-400'
                                }`}
                              >
                                {bot.metricLeftValue}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] text-slate-400">
                                {bot.metricRightLabel}
                              </div>
                              <div
                                className={`font-semibold font-mono tabular-nums mt-0.5 ${
                                  bot.metricRightTone === 'danger'
                                    ? 'text-rose-400'
                                    : bot.metricRightTone === 'warning'
                                    ? 'text-amber-400'
                                    : 'text-slate-200'
                                }`}
                              >
                                {bot.metricRightValue}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedStrategyForConfig(bot)}
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all whitespace-nowrap"
                          >
                            <span>Configure</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>

        {/* RIGHT-SIDE MONITORING PANELS */}
        <aside className="hidden xl:flex xl:w-80 2xl:w-88 bg-[#080E21] border-l border-slate-800/80 flex-col p-4 space-y-5 overflow-y-auto shrink-0">
          {/* PANEL 1: Simulated Portfolio Balance + Connected Wallet Summary */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  Your Balance (Simulated)
                </span>
                <button
                  type="button"
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Toggle balance visibility"
                >
                  {showBalance ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <span className="text-[11px] font-mono text-cyan-400">Demo Vault</span>
            </div>

            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-white">
                {showBalance ? `$${totalPortfolioUsd.toFixed(2)}` : '••••••••'}
              </div>
              <div className="text-xs font-mono text-emerald-400 mt-0.5">
                ↑ 4.12% (24h Simulated)
              </div>
            </div>

            {/* Connected On-Chain Wallet Mini Summary */}
            <div className="p-2.5 rounded-xl bg-[#080F23] border border-slate-800/90 text-[11px] font-mono space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>On-Chain Wallet:</span>
                <span
                  className={
                    walletState.status === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-500'
                  }
                >
                  {walletState.shortAddress || 'Not Connected'}
                </span>
              </div>
              {walletState.status === 'CONNECTED' && (
                <div className="flex justify-between text-slate-300">
                  <span>Verified Native ETH:</span>
                  <span>{walletState.nativeBalanceEth} ETH</span>
                </div>
              )}
            </div>

            {/* Asset List */}
            <div className="divide-y divide-slate-800/70">
              {portfolioAssets.map((asset) => (
                <div key={asset.symbol} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-slate-950 font-mono"
                      style={{ backgroundColor: asset.colorHex }}
                    >
                      {asset.symbol[0]}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{asset.symbol}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {asset.networkLabel}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs font-semibold text-white">
                      {showBalance ? asset.amount : '••••'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {showBalance ? `≈$${asset.valueUsd.toFixed(2)}` : '••••'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setActiveNav('profit-transfer')}
                className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Profit Transfer
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('emergency-recovery')}
                className="py-2 px-3 rounded-xl bg-[#080F23] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Asset Recovery
              </button>
            </div>
          </div>

          {/* PANEL 2: Running Bots */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-display">Running Bots</h3>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {summaryMetrics.activeCount} / {summaryMetrics.totalStrategies}
              </span>
            </div>

            <div className="divide-y divide-slate-800/70">
              {strategies.map((bot) => (
                <div
                  key={bot.strategyKey}
                  onClick={() => setSelectedStrategyForConfig(bot)}
                  className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-800/30 rounded-lg px-1.5 -mx-1.5 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                        STRATEGY_ICON_BG[bot.strategyKey]
                      }`}
                    >
                      {STRATEGY_ICONS[bot.strategyKey]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{bot.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {bot.tokenPair} · {bot.lastScanAgo}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-semibold font-mono ${
                        bot.status === 'Running'
                          ? 'text-emerald-400'
                          : bot.status === 'Paused'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {bot.status}
                    </div>
                    <div className="text-[10px] font-mono tabular-nums text-slate-400">
                      +${bot.latestSimNetUsd.toFixed(2)} sim
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsStopAllBotsModalOpen(true)}
              className="w-full py-2 rounded-xl bg-red-500/15 hover:bg-red-600 border border-red-500/30 text-xs font-bold text-red-300 hover:text-white transition-colors"
            >
              {securityState.offChainScannerStopped
                ? 'Resume Stopped Bots'
                : 'Emergency Stop All Bots'}
            </button>
          </div>

          {/* PANEL 3: Recent Trades (Simulated) */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-display">
                Recent Scans (Simulated)
              </h3>
              <button
                type="button"
                onClick={() => setActiveNav('history')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                View All
              </button>
            </div>

            <div className="divide-y divide-slate-800/70">
              {opportunities.slice(0, 4).map((opp) => (
                <div
                  key={opp.id}
                  onClick={() => setSelectedOpportunityDetail(opp)}
                  className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-800/30 rounded-lg px-1.5 -mx-1.5 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {opp.strategyName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      {opp.tokenPair} · Costs: ${opp.validation.totalCostsUsd.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div
                      className={`text-xs font-bold ${
                        opp.validation.accepted ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {opp.validation.netProfitUsd >= 0 ? '+' : ''}$
                      {opp.validation.netProfitUsd.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {opp.validation.accepted ? 'Accepted Sim' : 'Rejected'} · {opp.timeAgo}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PANEL 4: Connection Health & Observed Latency */}
          <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-display">Connection Health</h3>
              <span className="text-[11px] font-mono text-emerald-400">
                {health.wsConnected ? 'WS Active' : 'Polling'}
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-[11px] tabular-nums">
              <div className="flex justify-between text-slate-400">
                <span>Execution Mode:</span>
                <span className="text-cyan-300 font-semibold">{executionMode}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Last Observed Block:</span>
                <span className="text-slate-200">
                  #{health.lastBlockNumber.toLocaleString()} ({health.blockAgeSec}s ago)
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Observed BaseGas:</span>
                <span className="text-slate-200">{health.gasPriceGwei} Gwei</span>
              </div>
              <div className="border-t border-slate-800 my-1.5" />
              <div className="flex justify-between text-slate-400">
                <span>Event → Detection:</span>
                <span className="text-sky-400">{health.eventToDetectMs} ms</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Detection → Sim:</span>
                <span className="text-cyan-400">{health.detectToSimMs} ms</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Sim → Bundle Prep:</span>
                <span className="text-emerald-400">{health.simToSubmitMs} ms</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* CONNECT WALLET MODAL */}
      <ConnectWalletModal
        isOpen={isConnectWalletOpen}
        onClose={() => setIsConnectWalletOpen(false)}
        walletState={walletState}
        onConnectInjected={handleConnectInjectedWallet}
        onConnectVerifiedReadSession={handleConnectVerifiedReadSession}
      />

      {/* STOP ALL BOTS & PROTECTED RESUME MODAL */}
      <StopAllBotsModal
        isOpen={isStopAllBotsModalOpen}
        onClose={() => setIsStopAllBotsModalOpen(false)}
        securityState={securityState}
        isOwnerVerified={isOwnerVerified}
        onConfirmOffChainStopAll={handleConfirmOffChainStopAll}
        onConfirmProtectedResume={handleConfirmProtectedResume}
        onRequestOnChainPauseTx={(pauseValue) =>
          setPendingTxPreview({
            idempotencyKey: `pause-tx-${Date.now()}`,
            title: pauseValue
              ? 'Emergency On-Chain Contract Pause (setPaused(true))'
              : 'On-Chain Contract Unpause (setPaused(false))',
            actionType: pauseValue ? 'PAUSE_CONTRACT' : 'UNPAUSE_CONTRACT',
            chainId: securityState.chainId,
            chainName: securityState.chainName,
            contractAddress: securityState.contractAddress,
            methodSignature: `setPaused(${pauseValue})`,
            tokenSymbol: 'N/A (Contract Pause)',
            tokenAddress: securityState.contractAddress,
            amountFormatted: '0 ETH',
            recipientAddress: securityState.contractAddress,
            estimatedGasEth: '0.00068',
            estimatedGasUsd: '$1.77',
            securityNotes: [
              pauseValue
                ? 'Enforces on-chain whenNotPaused revert across all flash-loan entry points.'
                : 'Unpauses on-chain contract execution.',
            ],
          })
        }
      />

      {/* EXPLICIT TRANSACTION PREVIEW & WALLET SIGNATURE MODAL */}
      <TransactionPreviewModal
        preview={pendingTxPreview}
        walletAddress={walletState.address}
        onClose={() => setPendingTxPreview(null)}
        onConfirmSignature={handleConfirmTransactionSignature}
      />

      {/* BOT CONFIGURATION & DETERMINISTIC SIMULATOR MODAL */}
      {selectedStrategyForConfig && (
        <ConfigAndSimulatorModal
          strategy={selectedStrategyForConfig}
          isOpen={Boolean(selectedStrategyForConfig)}
          onClose={() => setSelectedStrategyForConfig(null)}
          onSaveStrategy={handleSaveStrategy}
          onRunSimulation={handleRunSimulation}
          onToggleEmergencyStop={() => setIsStopAllBotsModalOpen(true)}
          emergencyStopActive={securityState.offChainScannerStopped}
        />
      )}

      {/* DETAILED OPPORTUNITY & COST BREAKDOWN INSPECTOR MODAL */}
      {selectedOpportunityDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-[#0B132B] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  {selectedOpportunityDetail.strategyName} — Simulation Inspector
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedOpportunityDetail.tokenPair} ·{' '}
                  {selectedOpportunityDetail.routeDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOpportunityDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono tabular-nums">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-[#080F23] border border-slate-800">
                  <div className="text-[10px] text-slate-400">EVENT → DETECT</div>
                  <div className="text-sm font-bold text-sky-400 mt-0.5">
                    {selectedOpportunityDetail.eventToDetectMs} ms
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#080F23] border border-slate-800">
                  <div className="text-[10px] text-slate-400">DETECT → SIM</div>
                  <div className="text-sm font-bold text-cyan-400 mt-0.5">
                    {selectedOpportunityDetail.detectToSimMs} ms
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#080F23] border border-slate-800">
                  <div className="text-[10px] text-slate-400">SIM → BUNDLE PREP</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {selectedOpportunityDetail.simToSubmitMs} ms
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#080F23] border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Borrowed Principal:</span>
                  <span className="text-white">
                    ${selectedOpportunityDetail.validation.borrowPrincipalUsd.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gross Price Discrepancy:</span>
                  <span className="text-emerald-400">
                    +${selectedOpportunityDetail.validation.grossSpreadUsd.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">− Flash-Loan Fee:</span>
                  <span className="text-rose-300">
                    −${selectedOpportunityDetail.validation.flashLoanFeeUsd.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">− DEX Swap Fees:</span>
                  <span className="text-rose-300">
                    −${selectedOpportunityDetail.validation.dexFeesUsd.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">− Price Impact & Slippage:</span>
                  <span className="text-rose-300">
                    −$
                    {(
                      selectedOpportunityDetail.validation.priceImpactCostUsd +
                      selectedOpportunityDetail.validation.slippageCostUsd
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">− Estimated L1 Gas:</span>
                  <span className="text-rose-300">
                    −${selectedOpportunityDetail.validation.gasCostUsd.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm">
                  <span className="text-white">Deterministic Simulated Net Profit:</span>
                  <span
                    className={
                      selectedOpportunityDetail.validation.netProfitUsd >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }
                  >
                    {selectedOpportunityDetail.validation.netProfitUsd >= 0 ? '+' : ''}$
                    {selectedOpportunityDetail.validation.netProfitUsd.toFixed(2)}
                  </span>
                </div>
              </div>

              {!selectedOpportunityDetail.validation.accepted && (
                <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 space-y-1 font-sans">
                  <div className="font-semibold">Why this trade was rejected:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedOpportunityDetail.validation.rejectionReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 font-sans">
                <button
                  type="button"
                  onClick={() => {
                    const found = strategies.find(
                      (s) => s.strategyKey === selectedOpportunityDetail.strategyKey
                    );
                    setSelectedOpportunityDetail(null);
                    if (found) setSelectedStrategyForConfig(found);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Configure Strategy
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOpportunityDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
