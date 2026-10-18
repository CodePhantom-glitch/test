import React, { useState } from 'react';
import {
  FileCode2,
  Terminal,
  ShieldAlert,
  CheckCircle2,
  BookOpen,
  FolderTree,
  Lock,
  Copy,
  Check,
  ClipboardCheck,
} from 'lucide-react';

const PROJECT_TREE = `FlashAI/
├── .env.example                                   # Environment template (Zero private keys)
├── contracts/
│   └── FlashAIArbitrageExecutor.sol               # Solidity ^0.8.24 Ownable2Step + Reentrancy + Recovery
├── server.ts                                      # Express + WebSocket + Rate Limit + Idempotency Server
├── package.json                                   # Exact dependency versions & scripts
├── tsconfig.json                                  # Strict TypeScript configuration
└── src/
    ├── App.tsx                                    # Main Trading, Wallet, Stop-All-Bots & Security Dashboard
    ├── db/
    │   ├── drizzle.config.ts                      # Drizzle Kit PostgreSQL migration config
    │   ├── index.ts                               # Object-method pg.Pool connection manager
    │   ├── schema.ts                              # PostgreSQL tables (users, strategies, simulations, wallet_sessions, contract_actions, bot_execution_jobs)
    │   └── users.ts                               # Type-safe repository & sanitized error handlers
    ├── engine/
    │   ├── profitValidator.ts                     # Deterministic BigInt profit & repayment validator
    │   └── defaultData.ts                         # 6 Bot archetypes & 21-case verification test suite
    ├── lib/
    │   ├── firebase.ts                            # Client Google Sign-In initializer
    │   ├── firebase-admin.ts                      # Server-side token verification
    │   └── web3Wallet.ts                          # Non-custodial Ethers v6 Wallet & On-Chain Balance Verifier
    ├── middleware/
    │   └── auth.ts                                # Express Bearer token verification
    └── components/
        ├── HeroIllustration.tsx                   # Custom FlashAI Sentinel & Ethereum Node SVG
        ├── ConfigAndSimulatorModal.tsx            # Strategy Config & Live Deterministic Simulator
        ├── ConnectWalletModal.tsx                 # MetaMask, WalletConnect QR & On-Chain RPC Verifier
        ├── TransactionPreviewModal.tsx            # Explicit Pre-Signature Parameter Verification Gate
        ├── StopAllBotsModal.tsx                   # Off-Chain Stop, Queue Cancel & On-Chain Pause Modal
        ├── WalletAndSecurityCenterView.tsx        # 8 Security Cards, Allowance Revoker & Owner Controls
        ├── EmergencyRecoveryAndProfitView.tsx     # Emergency Asset Recovery & Idempotent Profit Transfer
        ├── SimulationAndBacktestView.tsx          # 21-Scenario Test Runner & Backtesting Analytics
        └── DocsAndSetupView.tsx                   # Smart Contract Audit, Checklist & Windows Setup Guide`;

const WINDOWS_SETUP_COMMANDS = `# 1. Clone the repository and enter project directory (Windows PowerShell / CMD)
git clone https://github.com/your-org/flashai-arbitrage-dashboard.git
cd flashai-arbitrage-dashboard

# 2. Copy the environment template and configure PostgreSQL & RPC endpoints
copy .env.example .env
# Edit .env in VS Code or Notepad:
# Set SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD, SQL_ADMIN_USER, SQL_ADMIN_PASSWORD
# Set ETH_RPC_URL="https://ethereum-rpc.publicnode.com"
# Set ETH_SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
# NEVER place wallet private keys or seed phrases in .env

# 3. Install exact dependencies (React 19, Ethers 6.17, Drizzle ORM 0.45, Express 4.21, WS 8.22)
npm install

# 4. Push PostgreSQL schema via Drizzle Kit (creates users, strategies, simulations, wallet_sessions, contract_actions, bot_execution_jobs)
npx drizzle-kit push --config=./src/db/drizzle.config.ts

# 5. Validate TypeScript types & 21-case deterministic test engine
npm run lint

# 6. Start the full-stack development server (Frontend + Express API + WebSocket on port 3000)
npm run dev
# Open http://localhost:3000 in your browser`;

const SEPOLIA_TESTNET_VERIFICATION = `# Sepolia Testnet Verification & Hardhat / Foundry Deployment Guide (Testnet Only)
# Do NOT deploy to Mainnet without an independent external smart contract security audit.

# 1. Verify contract compilation with Solidity ^0.8.24 (optimizer runs: 200)
npx hardhat compile

# 2. Deploy FlashAIArbitrageExecutor to Ethereum Sepolia Testnet (Chain ID: 11155111)
# Constructor arguments:
#   providerAddress:        0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A (Aave V3 Sepolia PoolAddressesProvider)
#   initialProfitRecipient: <Your_Verified_Owner_Wallet_Address>
#   initialRouters:         ["0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"] (Uniswap V3 Sepolia SwapRouter02)
#   initialTokens:          ["0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"]

# 3. Verify source code on Sepolia Etherscan
npx hardhat verify --network sepolia <DEPLOYED_CONTRACT_ADDRESS> \\
  "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A" \\
  "<YOUR_OWNER_ADDRESS>" \\
  "[\\"0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E\\"]" \\
  "[\\"0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238\\"]"`;

const MANUAL_SECURITY_REVIEW_CHECKLIST = [
  '1. Zero Custodial Secrets: Confirm no private keys, seed phrases, or mnemonics exist in .env, browser storage, PostgreSQL, or server logs.',
  '2. Explicit Transaction Preview: Verify every state-changing action displays Chain ID, Contract Address, Method Signature, Token, Amount, Recipient, and Estimated Gas before wallet signing.',
  '3. Bounded ERC-20 Approvals: Confirm token approvals default to exact trade bounds and never MaxUint256, with 1-click 0-allowance revocation.',
  '4. On-Chain Owner Verification: Confirm privileged actions check contract.owner() on-chain rather than trusting client-side flags.',
  '5. Callback & Initiator Guards: Confirm executeOperation validates both msg.sender == address(POOL) and initiator == address(this) + _flashLoanInProgress.',
  '6. Separation of Pause & Recovery: Confirm Stop All Bots halts off-chain scheduling and cancels QUEUED jobs without auto-triggering bulk asset withdrawals.',
  '7. Idempotent Profit Distribution: Confirm transferResidualProfit requires flash-loan repayment proof first and records transferId to block duplicate replay.',
];

export const DocsAndSetupView: React.FC = () => {
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBlock(id);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Architecture & Execution Modes Overview */}
      <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono">
          <BookOpen className="w-4 h-4" />
          ARCHITECTURE, SECURITY SAFEGUARDS & INSTALLATION GUIDE
        </div>
        <h2 className="text-2xl font-bold text-white font-display">
          FlashAI Documentation, Smart Contract Security & Windows Setup
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
          FlashAI enforces a non-custodial security model: users retain full control of their wallet
          and private keys, deterministic BigInt arithmetic validates every arbitrage route, and
          privileged contract controls are verified against on-chain ownership.
        </p>

        {/* 4 Execution Modes */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-[#080F23] border border-slate-800">
            <div className="text-xs font-mono text-cyan-400 font-semibold">1. DEMO MODE</div>
            <div className="text-sm font-bold text-white mt-1">Deterministic Sample Pools</div>
            <p className="text-xs text-slate-400 mt-1">
              No wallet or RPC key required. Uses deterministic pool snapshots clearly labeled as
              simulated.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#080F23] border border-slate-800">
            <div className="text-xs font-mono text-emerald-400 font-semibold">
              2. SIMULATION MODE
            </div>
            <div className="text-sm font-bold text-white mt-1">Local Fork & 21-Case Harness</div>
            <p className="text-xs text-slate-400 mt-1">
              Tests all 21 edge cases (stale data, swap revert, gas spike, reentrancy, owner guards,
              recovery, profit transfer) with zero real transaction submission.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#080F23] border border-slate-800">
            <div className="text-xs font-mono text-blue-400 font-semibold">3. MONITORING MODE</div>
            <div className="text-sm font-bold text-white mt-1">Live Public Ethereum RPC</div>
            <p className="text-xs text-slate-400 mt-1">
              Reads live block numbers, timestamps, and on-chain wallet/contract balances via
              ethers.js while keeping live arbitrage execution disabled.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30">
            <div className="text-xs font-mono text-rose-400 font-semibold flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              4. LIVE EXECUTION (DISABLED)
            </div>
            <div className="text-sm font-bold text-white mt-1">Architectural Placeholder</div>
            <p className="text-xs text-slate-300 mt-1">
              Mainnet transaction submission and automated withdrawals are disabled by default
              during development.
            </p>
          </div>
        </div>
      </div>

      {/* Windows Setup & Project Structure Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base font-bold text-white font-display">
                Windows PowerShell / CMD Local Setup Guide
              </h3>
            </div>
            <button
              type="button"
              onClick={() => copyText('win', WINDOWS_SETUP_COMMANDS)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
            >
              {copiedBlock === 'win' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Commands
                </>
              )}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#060B19] border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
            {WINDOWS_SETUP_COMMANDS}
          </pre>
        </div>

        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white font-display">
              Full-Stack Project Directory Structure
            </h3>
          </div>

          <pre className="p-4 rounded-xl bg-[#060B19] border border-slate-800 text-xs font-mono text-cyan-200/90 overflow-x-auto leading-relaxed">
            {PROJECT_TREE}
          </pre>
        </div>
      </div>

      {/* Sepolia Testnet Verification & Manual Security Audit Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base font-bold text-white font-display">
                Sepolia Testnet Deployment & Verification Guide
              </h3>
            </div>
            <button
              type="button"
              onClick={() => copyText('sep', SEPOLIA_TESTNET_VERIFICATION)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
            >
              {copiedBlock === 'sep' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Guide
                </>
              )}
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-[#060B19] border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {SEPOLIA_TESTNET_VERIFICATION}
          </pre>
        </div>

        <div className="bg-[#0B132B] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-white font-display">
              Manual Security Review Checklist & Trust Assumptions
            </h3>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-300">
            {MANUAL_SECURITY_REVIEW_CHECKLIST.map((item, idx) => (
              <li
                key={idx}
                className="p-2.5 rounded-lg bg-[#080F23] border border-slate-800 flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
