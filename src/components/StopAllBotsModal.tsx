import React, { useState } from 'react';
import {
  OctagonAlert,
  X,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { ContractSecurityState } from '../types/arbitrage.ts';

interface StopAllBotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  securityState: ContractSecurityState;
  isOwnerVerified: boolean;
  onConfirmOffChainStopAll: () => Promise<void>;
  onRequestOnChainPauseTx: (pauseValue: boolean) => void;
  onConfirmProtectedResume: () => Promise<void>;
}

export const StopAllBotsModal: React.FC<StopAllBotsModalProps> = ({
  isOpen,
  onClose,
  securityState,
  isOwnerVerified,
  onConfirmOffChainStopAll,
  onRequestOnChainPauseTx,
  onConfirmProtectedResume,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resumeAckChecked, setResumeAckChecked] = useState(false);

  if (!isOpen) return null;

  const handleStopAll = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmOffChainStopAll();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResume = async () => {
    if (!resumeAckChecked) return;
    setIsSubmitting(true);
    try {
      await onConfirmProtectedResume();
      setResumeAckChecked(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-[#0B132B] border border-red-500/40 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-red-950/50 border-b border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <OctagonAlert className="w-6 h-6 text-red-400" />
            <div>
              <h2 className="text-lg font-bold text-white font-display">
                {securityState.offChainScannerStopped
                  ? 'Protected Bot System Resume & On-Chain Pause Control'
                  : 'Emergency Stop All Bots — Confirmation'}
              </h2>
              <p className="text-xs text-red-200">
                Off-Chain Backend Scheduler & On-Chain Smart Contract Pause Controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Separate Status Indicators: Off-Chain vs On-Chain */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#080F23] border border-slate-800 space-y-1">
              <div className="text-[11px] font-mono text-slate-400">
                1. OFF-CHAIN BACKEND SCHEDULER
              </div>
              <div className="text-sm font-bold font-mono flex items-center gap-1.5">
                {securityState.offChainScannerStopped ? (
                  <span className="text-red-400">STOPPED (ALL 6 BOTS PAUSED)</span>
                ) : (
                  <span className="text-emerald-400">ACTIVE (SCANNING POOLS)</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Cancelled Queued Jobs: {securityState.queuedJobsCancelled}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#080F23] border border-slate-800 space-y-1">
              <div className="text-[11px] font-mono text-slate-400">
                2. ON-CHAIN SMART CONTRACT STATE
              </div>
              <div className="text-sm font-bold font-mono flex items-center gap-1.5">
                {securityState.onChainPaused ? (
                  <span className="text-amber-400">PAUSED ON-CHAIN (whenNotPaused)</span>
                ) : (
                  <span className="text-cyan-400">UNPAUSED (READY)</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate">
                Contract: {securityState.contractAddress}
              </div>
            </div>
          </div>

          {/* Effects Explanation */}
          <div className="p-4 rounded-xl bg-[#080F23] border border-slate-800 space-y-2 text-slate-300">
            <div className="font-semibold text-white">
              What happens when you trigger Stop All Bots:
            </div>
            <ul className="list-disc list-inside space-y-1 leading-relaxed">
              <li>
                Immediately disables new execution scheduling in the backend and blocks new
                submission requests server-side.
              </li>
              <li>
                Halts active off-chain pool scanning and cancels all unsubmitted{' '}
                <code className="text-cyan-300">QUEUED</code> jobs in PostgreSQL.
              </li>
              <li>
                Sets all 6 arbitrage strategies to <code className="text-amber-300">Paused</code> in
                persistent database state.
              </li>
              <li>
                Does <strong>not</strong> automatically trigger a bulk withdrawal or recovery (asset
                recovery is strictly separate).
              </li>
            </ul>
          </div>

          {/* Crucial Pending Transaction Warning */}
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">
                Important Mempool & Pending Transaction Notice
              </div>
              <p className="mt-0.5 leading-relaxed">
                Stopping off-chain bots cannot cancel a transaction that has already been signed and
                broadcast to the Ethereum mempool. Any pending transaction may still be included in
                a block by validators.
              </p>
            </div>
          </div>

          {/* Optional On-Chain Smart Contract Pause Action (Owner-Only) */}
          <div className="p-4 rounded-xl bg-[#080F23] border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                On-Chain Smart Contract Pause (`setPaused`)
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isOwnerVerified
                  ? 'Your connected wallet matches contract.owner(). You may sign an on-chain pause/unpause transaction.'
                  : 'Requires connected wallet matching the verified contract owner address.'}
              </p>
            </div>
            <button
              type="button"
              disabled={!isOwnerVerified}
              onClick={() => {
                onClose();
                onRequestOnChainPauseTx(!securityState.onChainPaused);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-xs font-semibold text-cyan-300 whitespace-nowrap"
            >
              {securityState.onChainPaused
                ? 'Preview On-Chain Unpause Tx'
                : 'Preview On-Chain Pause Tx'}
            </button>
          </div>

          {/* Protected Resume Flow if currently stopped */}
          {securityState.offChainScannerStopped ? (
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
              <div className="font-semibold text-emerald-300">
                Protected Resume Verification
              </div>
              <label className="flex items-start gap-2.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resumeAckChecked}
                  onChange={(e) => setResumeAckChecked(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700"
                />
                <span>
                  I have verified RPC freshness, gas limits, and strategy thresholds, and explicitly
                  authorize resuming off-chain simulation scanning.
                </span>
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-semibold"
                >
                  Keep Stopped
                </button>
                <button
                  type="button"
                  disabled={!resumeAckChecked || isSubmitting}
                  onClick={handleResume}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isSubmitting ? 'Resuming...' : 'Confirm Protected Resume'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleStopAll}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-600/30"
              >
                <OctagonAlert className="w-4 h-4" />
                {isSubmitting ? 'Stopping All Bots...' : 'Confirm STOP ALL BOTS'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
