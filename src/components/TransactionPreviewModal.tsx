import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Lock,
} from 'lucide-react';
import { TransactionPreviewPayload } from '../types/arbitrage.ts';

interface TransactionPreviewModalProps {
  preview: TransactionPreviewPayload | null;
  walletAddress: string | null;
  onClose: () => void;
  onConfirmSignature: (preview: TransactionPreviewPayload) => Promise<void>;
}

export const TransactionPreviewModal: React.FC<TransactionPreviewModalProps> = ({
  preview,
  walletAddress,
  onClose,
  onConfirmSignature,
}) => {
  const [isSigning, setIsSigning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!preview) return null;

  const handleSign = async () => {
    setIsSigning(true);
    setErrorMsg(null);
    try {
      await onConfirmSignature(preview);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Wallet signature rejected or transaction simulation failed.');
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-[#0B132B] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-bold text-white font-display">{preview.title}</h3>
              <p className="text-xs text-slate-400 font-mono">
                Explicit Non-Custodial Transaction Signature Request
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

        {/* Transaction Parameter Verification Table */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-[#080F23] border border-slate-800 space-y-2.5 text-xs font-mono tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-400">Signing Wallet (Caller):</span>
              <span className="text-cyan-300 truncate max-w-[280px]">
                {walletAddress || 'Not Connected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Network & Chain ID:</span>
              <span className="text-white">
                {preview.chainName} (Chain ID: {preview.chainId})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Verified Contract Address:</span>
              <span className="text-slate-200 truncate max-w-[280px]">
                {preview.contractAddress}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Contract Method:</span>
              <span className="text-emerald-400 font-semibold">{preview.methodSignature}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Asset / Token:</span>
              <span className="text-white">
                {preview.tokenSymbol} ({preview.tokenAddress.slice(0, 8)}...
                {preview.tokenAddress.slice(-6)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Exact Amount:</span>
              <span className="text-white font-bold">{preview.amountFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Destination / Spender:</span>
              <span className="text-amber-300 truncate max-w-[280px]">
                {preview.recipientAddress}
              </span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between">
              <span className="text-slate-400">Estimated Network Gas:</span>
              <span className="text-slate-200">
                {preview.estimatedGasEth} ETH (≈ {preview.estimatedGasUsd})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Idempotency Reference:</span>
              <span className="text-slate-500">{preview.idempotencyKey}</span>
            </div>
          </div>

          {/* Security Disclosures */}
          <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-slate-200 space-y-1.5">
            <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <FileCode2 className="w-4 h-4" />
              Pre-Signature Verification Checklist
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
              {preview.securityNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
              <li>
                Confirmed blockchain transactions are irreversible once included in a block.
              </li>
            </ul>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSigning}
              onClick={handleSign}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSigning ? 'Awaiting Wallet Signature...' : 'Approve & Sign in Wallet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
