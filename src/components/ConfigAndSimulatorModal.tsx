import React, { useState, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Play,
  Sparkles,
  CheckCircle2,
  XCircle,
  Pause,
  OctagonAlert,
  Save,
  RotateCcw,
  Sliders,
  Info,
} from 'lucide-react';
import {
  ProfitValidationBreakdown,
  ProfitValidationInput,
  ScenarioCaseType,
  StrategyConfig,
} from '../types/arbitrage.ts';
import { validateArbitrageOpportunity } from '../engine/profitValidator.ts';

interface ConfigAndSimulatorModalProps {
  strategy: StrategyConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaveStrategy: (updated: StrategyConfig) => Promise<void>;
  onRunSimulation: (
    strategy: StrategyConfig,
    input: ProfitValidationInput,
    scenarioType: ScenarioCaseType
  ) => Promise<ProfitValidationBreakdown>;
  onToggleEmergencyStop: () => void;
  emergencyStopActive: boolean;
}

const NETWORK_OPTIONS = [
  'Ethereum Mainnet',
  'Arbitrum One (Simulation)',
  'Optimism Mainnet (Simulation)',
  'Base Mainnet (Simulation)',
  'Ethereum ↔ Arbitrum (Cross-Chain Sim)',
];

const DEX_OPTIONS = [
  'Uniswap V3 (0.05%)',
  'Uniswap V3 (0.30%)',
  'SushiSwap V2 (0.30%)',
  'Curve 3pool (0.01%)',
  'Curve Tricrypto',
  'Balancer V2 Vault',
];

const FLASH_PROVIDERS = [
  { label: 'Aave V3 (0.05% Fee)', feeBps: 5 },
  { label: 'Balancer V2 (0.00% Fee)', feeBps: 0 },
  { label: 'Uniswap V3 Flash (0.05% Fee)', feeBps: 5 },
];

export const ConfigAndSimulatorModal: React.FC<ConfigAndSimulatorModalProps> = ({
  strategy,
  isOpen,
  onClose,
  onSaveStrategy,
  onRunSimulation,
  onToggleEmergencyStop,
  emergencyStopActive,
}) => {
  const [formState, setFormState] = useState<StrategyConfig>({ ...strategy });

  // Simulation market condition parameters
  const [scenarioPreset, setScenarioPreset] = useState<ScenarioCaseType>('normal_profitable');
  const [grossSpreadBps, setGrossSpreadBps] = useState<number>(58);
  const [dexFeeBpsTotal, setDexFeeBpsTotal] = useState<number>(
    strategy.strategyKey === 'stablecoin' ? 3 : 35
  );
  const [priceImpactBps, setPriceImpactBps] = useState<number>(
    strategy.strategyKey === 'stablecoin' ? 1 : 4
  );
  const [expectedSlippageBps, setExpectedSlippageBps] = useState<number>(3);
  const [gasPriceGwei, setGasPriceGwei] = useState<number>(19);
  const [ethPriceUsd, setEthPriceUsd] = useState<number>(2600);
  const [relayBuilderTipUsd, setRelayBuilderTipUsd] = useState<number>(
    strategy.strategyKey === 'mev-backrun' ? 6.5 : 0
  );
  const [snapshotAgeSec, setSnapshotAgeSec] = useState<number>(4);
  const [swapReverted, setSwapReverted] = useState<boolean>(false);
  const [reentrancyDetected, setReentrancyDetected] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // AI Advisory state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvisoryText, setAiAdvisoryText] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState<string>('');

  const validationInput: ProfitValidationInput = useMemo(
    () => ({
      strategyName: formState.name,
      tokenSymbol: formState.tokenPair.split('/')[0].trim(),
      tokenDecimals: formState.tokenDecimals,
      borrowAmountUsd: Number(formState.borrowAmountUsd),
      minBorrowUsd: Number(formState.minBorrowUsd),
      maxBorrowUsd: Number(formState.maxBorrowUsd),
      grossSpreadBps,
      flashLoanFeeBps: formState.flashLoanFeeBps,
      dexFeeBpsTotal,
      priceImpactBps,
      maxPriceImpactBps: Number(formState.maxPriceImpactBps),
      expectedSlippageBps,
      maxSlippageBps: Number(formState.maxSlippageBps),
      gasLimitUnits: 240000 + Number(formState.maxHops) * 45000,
      gasPriceGwei,
      ethPriceUsd,
      maxGasUsd: Number(formState.maxGasUsd),
      relayBuilderTipUsd,
      otherExecutionCostsUsd: formState.strategyKey === 'multi-chain' ? 8.5 : 0,
      hopCount: formState.routePath.length > 1 ? formState.routePath.length - 1 : 2,
      maxHops: Number(formState.maxHops),
      snapshotAgeSec,
      staleDataThresholdSec: Number(formState.staleDataThresholdSec),
      minNetProfitUsd: Number(formState.minNetProfitUsd),
      minNetProfitPct: Number(formState.minNetProfitPct),
      swapReverted,
      reentrancyDetected,
      callbackAuthorized: !reentrancyDetected,
    }),
    [
      formState,
      grossSpreadBps,
      dexFeeBpsTotal,
      priceImpactBps,
      expectedSlippageBps,
      gasPriceGwei,
      ethPriceUsd,
      relayBuilderTipUsd,
      snapshotAgeSec,
      swapReverted,
      reentrancyDetected,
    ]
  );

  const liveBreakdown = useMemo(
    () => validateArbitrageOpportunity(validationInput),
    [validationInput]
  );

  if (!isOpen) return null;

  const applyScenarioPreset = (preset: ScenarioCaseType) => {
    setScenarioPreset(preset);
    setSwapReverted(false);
    setReentrancyDetected(false);
    setSnapshotAgeSec(4);
    setGasPriceGwei(19);

    switch (preset) {
      case 'normal_profitable':
        setGrossSpreadBps(formState.strategyKey === 'stablecoin' ? 12 : 62);
        break;
      case 'unprofitable_spread':
        setGrossSpreadBps(formState.strategyKey === 'stablecoin' ? 4 : 43);
        break;
      case 'stale_data':
        setGrossSpreadBps(65);
        setSnapshotAgeSec(Number(formState.staleDataThresholdSec) + 9);
        break;
      case 'failed_swap':
        setGrossSpreadBps(60);
        setSwapReverted(true);
        break;
      case 'insufficient_repayment':
        setGrossSpreadBps(28);
        break;
      case 'excessive_gas':
        setGrossSpreadBps(82);
        setGasPriceGwei(92);
        break;
      case 'reentrancy_blocked':
        setGrossSpreadBps(70);
        setReentrancyDetected(true);
        break;
      default:
        setGrossSpreadBps(54);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveBanner(null);
    try {
      await onSaveStrategy(formState);
      setSaveBanner('Strategy parameters validated and persisted to Cloud SQL.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerSimulation = async () => {
    if (emergencyStopActive) return;
    setIsSimulating(true);
    setSaveBanner(null);
    try {
      const res = await onRunSimulation(formState, validationInput, scenarioPreset);
      setSaveBanner(
        res.accepted
          ? `Simulation Accepted: Verified +$${res.netProfitUsd.toFixed(2)} net profit after all costs.`
          : `Simulation Rejected by Validator: ${res.rejectionReasons[0]}`
      );
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRequestAiAdvisor = async () => {
    setAiLoading(true);
    try {
      const response = await fetch('/api/ai/advise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'explain_and_optimize',
          strategy: formState,
          validation: liveBreakdown,
          customQuestion: aiQuestion,
        }),
      });
      const data = await response.json();
      if (data.error) {
        setAiAdvisoryText(`Advisor Alert: ${data.error}`);
      } else {
        setAiAdvisoryText(data.advisory);
      }
    } catch {
      setAiAdvisoryText(
        'Could not reach server-side AI Advisor. Deterministic profit validation remains active.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const applyConservativeAiSuggestion = () => {
    setFormState((prev) => ({
      ...prev,
      maxSlippageBps: 20,
      maxPriceImpactBps: 35,
      staleDataThresholdSec: 10,
      minNetProfitUsd: Math.max(10, Number(prev.minNetProfitUsd)),
    }));
    setSaveBanner(
      'Applied conservative risk bounds (Max Slippage 20 bps, Stale Threshold 10s). Click Save Configuration to persist.'
    );
  };

  const toggleDex = (dexName: string) => {
    setFormState((prev) => {
      const exists = prev.dexList.includes(dexName);
      const nextList = exists
        ? prev.dexList.filter((d) => d !== dexName)
        : [...prev.dexList, dexName];
      return {
        ...prev,
        dexList: nextList.length > 0 ? nextList : [dexName],
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#0B132B] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0F172A] border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white font-display">{formState.name}</h2>
              <span className="text-xs text-cyan-400 font-mono">
                {formState.categoryTag} · {formState.riskLevel} · Simulation Mode
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{formState.tagline}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setFormState((p) => ({
                  ...p,
                  status: p.status === 'Running' ? 'Paused' : 'Running',
                }))
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                formState.status === 'Running'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              <Pause className="w-3.5 h-3.5" />
              {formState.status === 'Running' ? 'Pause Strategy' : 'Resume Strategy'}
            </button>
            <button
              type="button"
              onClick={onToggleEmergencyStop}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                emergencyStopActive
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
              }`}
            >
              <OctagonAlert className="w-3.5 h-3.5" />
              {emergencyStopActive ? 'Emergency Stop Active' : 'Emergency Stop'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {saveBanner && (
          <div className="px-6 py-2.5 bg-cyan-950/60 border-b border-cyan-500/30 text-xs text-cyan-200 flex items-center justify-between">
            <span>{saveBanner}</span>
            <button
              type="button"
              onClick={() => setSaveBanner(null)}
              className="text-cyan-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body: 2-Column Split (Left: Config Form, Right: Live Deterministic Profit Breakdown & AI Advisor) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left Column: Strategy Parameters Form */}
          <form onSubmit={handleSave} className="lg:col-span-7 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Strategy & Risk Control Configuration
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                All parameters enforced deterministically
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Strategy Name</label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Blockchain / Network</label>
                <select
                  value={formState.network}
                  onChange={(e) => setFormState({ ...formState, network: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {NETWORK_OPTIONS.map((net) => (
                    <option key={net} value={net}>
                      {net}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Token Pair / Path</label>
                <input
                  type="text"
                  value={formState.tokenPair}
                  onChange={(e) => setFormState({ ...formState, tokenPair: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Flash-Loan Provider</label>
                <select
                  value={formState.flashLoanFeeBps}
                  onChange={(e) => {
                    const fee = Number(e.target.value);
                    const found = FLASH_PROVIDERS.find((p) => p.feeBps === fee);
                    setFormState({
                      ...formState,
                      flashLoanFeeBps: fee,
                      flashLoanProvider: found ? found.label : 'Aave V3 (0.05%)',
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {FLASH_PROVIDERS.map((prov) => (
                    <option key={prov.label} value={prov.feeBps}>
                      {prov.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Allowlisted DEXs & Pools */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Allowlisted DEX Routers & Pools (Select 2+)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DEX_OPTIONS.map((dex) => {
                  const active = formState.dexList.includes(dex);
                  return (
                    <button
                      type="button"
                      key={dex}
                      onClick={() => toggleDex(dex)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left border transition-colors truncate ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200'
                          : 'bg-[#060B19] border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {dex}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Borrow Amount & Bounds */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Borrow Principal (USD)
                </label>
                <input
                  type="number"
                  value={formState.borrowAmountUsd}
                  onChange={(e) =>
                    setFormState({ ...formState, borrowAmountUsd: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min Borrow Bound ($)</label>
                <input
                  type="number"
                  value={formState.minBorrowUsd}
                  onChange={(e) =>
                    setFormState({ ...formState, minBorrowUsd: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-slate-300 font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Trade Size ($)</label>
                <input
                  type="number"
                  value={formState.maxBorrowUsd}
                  onChange={(e) =>
                    setFormState({ ...formState, maxBorrowUsd: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-slate-300 font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Profit, Gas, Slippage, Hops, and Stale Thresholds */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Min Net Profit ($ USD)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formState.minNetProfitUsd}
                  onChange={(e) =>
                    setFormState({ ...formState, minNetProfitUsd: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-emerald-400 font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Min Net Margin (%)
                </label>
                <input
                  type="number"
                  step="0.005"
                  value={formState.minNetProfitPct}
                  onChange={(e) =>
                    setFormState({ ...formState, minNetProfitPct: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-emerald-400 font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Gas Cost ($ USD)</label>
                <input
                  type="number"
                  step="1"
                  value={formState.maxGasUsd}
                  onChange={(e) =>
                    setFormState({ ...formState, maxGasUsd: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Max Slippage (bps, 100=1%)
                </label>
                <input
                  type="number"
                  value={formState.maxSlippageBps}
                  onChange={(e) =>
                    setFormState({ ...formState, maxSlippageBps: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Max Price Impact (bps)
                </label>
                <input
                  type="number"
                  value={formState.maxPriceImpactBps}
                  onChange={(e) =>
                    setFormState({ ...formState, maxPriceImpactBps: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Stale-Data Threshold (sec)
                </label>
                <input
                  type="number"
                  value={formState.staleDataThresholdSec}
                  onChange={(e) =>
                    setFormState({ ...formState, staleDataThresholdSec: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Interactive Simulation Scenario Stress-Tester */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  Simulate Market & Stress Scenarios (Test Acceptance / Rejection Logic)
                </span>
                <span className="text-xs text-cyan-400 font-mono">
                  Spread: {grossSpreadBps} bps · Gas: {gasPriceGwei} Gwei · Age: {snapshotAgeSec}s
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { id: 'normal_profitable', label: 'Profitable Spread' },
                  { id: 'unprofitable_spread', label: 'Unprofitable After Fees' },
                  { id: 'stale_data', label: 'Stale Pool Data (>Threshold)' },
                  { id: 'failed_swap', label: 'Failed Swap Revert' },
                  { id: 'insufficient_repayment', label: 'Insufficient Repayment' },
                  { id: 'excessive_gas', label: 'Gas Spike (92 Gwei)' },
                  { id: 'reentrancy_blocked', label: 'Reentrancy Attack Test' },
                ].map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => applyScenarioPreset(sc.id as ScenarioCaseType)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      scenarioPreset === sc.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#060B19] text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Simulated Gross Spread (bps)
                  </label>
                  <input
                    type="number"
                    value={grossSpreadBps}
                    onChange={(e) => setGrossSpreadBps(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[#060B19] border border-slate-800 text-xs text-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Simulated L1 Gas (Gwei)
                  </label>
                  <input
                    type="number"
                    value={gasPriceGwei}
                    onChange={(e) => setGasPriceGwei(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[#060B19] border border-slate-800 text-xs text-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Pool Snapshot Age (sec)
                  </label>
                  <input
                    type="number"
                    value={snapshotAgeSec}
                    onChange={(e) => setSnapshotAgeSec(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[#060B19] border border-slate-800 text-xs text-white font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormState({ ...strategy })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#060B19] border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
              </div>

              <button
                type="button"
                disabled={isSimulating || emergencyStopActive}
                onClick={handleTriggerSimulation}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isSimulating ? 'Validating & Recording...' : 'Execute Simulated Scan'}
              </button>
            </div>
          </form>

          {/* Right Column: Live Deterministic Profit Breakdown & AI Advisor */}
          <div className="lg:col-span-5 p-6 bg-[#080F23] space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Deterministic Profit Validator
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold font-mono ${
                  liveBreakdown.accepted ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {liveBreakdown.accepted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ACCEPTED (SIMULATED)
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    REJECTED BY VALIDATOR
                  </>
                )}
              </span>
            </div>

            {/* Cost Breakdown Table */}
            <div className="bg-[#0B132B] border border-slate-800/90 rounded-xl p-4 space-y-2.5 text-xs font-mono tabular-nums">
              <div className="flex justify-between text-slate-400">
                <span>Borrowed Principal ({formState.tokenPair.split('/')[0].trim()}):</span>
                <span className="text-slate-200">
                  ${liveBreakdown.borrowPrincipalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Gross Price Discrepancy ({grossSpreadBps} bps):</span>
                <span className="text-emerald-400">
                  +${liveBreakdown.grossSpreadUsd.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-slate-800/80 my-1" />
              <div className="flex justify-between text-slate-400">
                <span>− Flash-Loan Fee ({formState.flashLoanFeeBps} bps):</span>
                <span className="text-rose-300">−${liveBreakdown.flashLoanFeeUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>− DEX Liquidity Fees ({dexFeeBpsTotal} bps):</span>
                <span className="text-rose-300">−${liveBreakdown.dexFeesUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>− Price Impact ({priceImpactBps} bps):</span>
                <span className="text-rose-300">
                  −${liveBreakdown.priceImpactCostUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>− Slippage Allowance ({expectedSlippageBps} bps):</span>
                <span className="text-rose-300">−${liveBreakdown.slippageCostUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>− Estimated L1 Gas ({gasPriceGwei} Gwei):</span>
                <span className="text-rose-300">−${liveBreakdown.gasCostUsd.toFixed(2)}</span>
              </div>
              {liveBreakdown.relayBuilderTipUsd > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>− MEV Builder / Relay Tip:</span>
                  <span className="text-rose-300">
                    −${liveBreakdown.relayBuilderTipUsd.toFixed(2)}
                  </span>
                </div>
              )}
              {liveBreakdown.otherExecutionCostsUsd > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>− Bridge / Settlement Cost:</span>
                  <span className="text-rose-300">
                    −${liveBreakdown.otherExecutionCostsUsd.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-slate-800 my-1.5" />
              <div className="flex justify-between text-slate-300">
                <span>Atomic Repayment Proof:</span>
                <span
                  className={
                    liveBreakdown.repaymentProven ? 'text-emerald-400' : 'text-rose-400 font-semibold'
                  }
                >
                  {liveBreakdown.repaymentProven
                    ? `PROVEN ($${liveBreakdown.requiredRepaymentUsd.toFixed(2)})`
                    : 'FAILED (ATOMIC REVERT)'}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1 text-sm font-bold">
                <span className="text-white">Simulated Net Profit:</span>
                <span
                  className={
                    liveBreakdown.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {liveBreakdown.netProfitUsd >= 0 ? '+' : ''}$
                  {liveBreakdown.netProfitUsd.toFixed(2)} ({liveBreakdown.profitMarginPct.toFixed(3)}
                  %)
                </span>
              </div>
            </div>

            {/* Acceptance / Rejection Diagnostic Box */}
            <div
              className={`rounded-xl p-3.5 border text-xs space-y-1.5 ${
                liveBreakdown.accepted
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                {liveBreakdown.accepted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    Deterministic Decision: Trade Accepted in Simulation
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    Deterministic Decision: Trade Rejected ({liveBreakdown.rejectionReasons.length}{' '}
                    rule violation{liveBreakdown.rejectionReasons.length === 1 ? '' : 's'})
                  </>
                )}
              </div>
              {liveBreakdown.accepted ? (
                <p className="text-slate-300 leading-relaxed">
                  Post-swap balance covers 100% of principal + flash-loan fee, and net profit (+$
                  {liveBreakdown.netProfitUsd.toFixed(2)}) exceeds the ${formState.minNetProfitUsd.toFixed(2)}{' '}
                  minimum threshold.
                </p>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-rose-200/90">
                  {liveBreakdown.rejectionReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* AI Strategy Advisor (Advisory Only, Server-Side Gemini) */}
            <div className="bg-[#0B132B] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white">
                    AI Strategy & Risk Advisor (Advisory Only)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRequestAiAdvisor}
                  disabled={aiLoading}
                  className="px-3 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-medium transition-colors whitespace-nowrap"
                >
                  {aiLoading ? 'Analyzing...' : 'Explain & Suggest Bounds'}
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="Ask why this route succeeded/failed or how to reduce slippage..."
                  className="flex-1 px-2.5 py-1.5 rounded bg-[#060B19] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {aiAdvisoryText ? (
                <div className="space-y-2.5">
                  <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed bg-[#060B19] p-3 rounded-lg border border-slate-800/80 max-h-40 overflow-y-auto">
                    {aiAdvisoryText}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Requires explicit approval & validator check:
                    </span>
                    <button
                      type="button"
                      onClick={applyConservativeAiSuggestion}
                      className="px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors"
                    >
                      Approve Conservative Bounds
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  AI explains cost drivers and suggests conservative bounds. Deterministic code
                  validates all trading decisions; secrets or private keys are never requested.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
