import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull()
    .unique(),
  executionMode: text('execution_mode').notNull().default('DEMO'), // DEMO | SIMULATION | MONITORING | LIVE_DISABLED
  rpcEndpoint: text('rpc_endpoint').notNull().default('https://ethereum-rpc.publicnode.com'),
  wsEndpoint: text('ws_endpoint').notNull().default('wss://ethereum-rpc.publicnode.com'),
  maxGlobalGasGwei: integer('max_global_gas_gwei').notNull().default(45),
  staleBlockThresholdSec: integer('stale_block_threshold_sec').notNull().default(24),
  emergencyStopActive: boolean('emergency_stop_active').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const strategies = pgTable('strategies', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').references(() => users.uid),
  strategyKey: text('strategy_key').notNull(), // classic | mev-backrun | multi-hop | multi-chain | stablecoin | custom-ai
  name: text('name').notNull(),
  network: text('network').notNull().default('Ethereum Mainnet'),
  dexList: jsonb('dex_list').$type<string[]>().notNull(),
  tokenPair: text('token_pair').notNull(),
  flashLoanProvider: text('flash_loan_provider').notNull().default('Aave V3 (0.05%)'),
  borrowAmountUsd: numeric('borrow_amount_usd', { precision: 18, scale: 2 }).notNull(),
  minBorrowUsd: numeric('min_borrow_usd', { precision: 18, scale: 2 }).notNull(),
  maxBorrowUsd: numeric('max_borrow_usd', { precision: 18, scale: 2 }).notNull(),
  maxHops: integer('max_hops').notNull().default(2),
  minNetProfitUsd: numeric('min_net_profit_usd', { precision: 18, scale: 2 }).notNull(),
  minNetProfitPct: numeric('min_net_profit_pct', { precision: 10, scale: 4 }).notNull(),
  maxGasUsd: numeric('max_gas_usd', { precision: 18, scale: 2 }).notNull(),
  maxSlippageBps: integer('max_slippage_bps').notNull().default(30),
  maxPriceImpactBps: integer('max_price_impact_bps').notNull().default(50),
  staleDataThresholdSec: integer('stale_data_threshold_sec').notNull().default(15),
  simulationOnly: boolean('simulation_only').notNull().default(true),
  status: text('status').notNull().default('Running'), // Running | Paused | Stopped
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const simulations = pgTable('simulations', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').references(() => users.uid),
  strategyKey: text('strategy_key').notNull(),
  strategyName: text('strategy_name').notNull(),
  network: text('network').notNull(),
  tokenPair: text('token_pair').notNull(),
  routeDescription: text('route_description').notNull(),
  scenarioType: text('scenario_type').notNull(),
  borrowAmountUsd: numeric('borrow_amount_usd', { precision: 18, scale: 2 }).notNull(),
  grossOutputUsd: numeric('gross_output_usd', { precision: 18, scale: 2 }).notNull(),
  grossProfitUsd: numeric('gross_profit_usd', { precision: 18, scale: 2 }).notNull(),
  flashLoanFeeUsd: numeric('flash_loan_fee_usd', { precision: 18, scale: 2 }).notNull(),
  dexFeesUsd: numeric('dex_fees_usd', { precision: 18, scale: 2 }).notNull(),
  gasCostUsd: numeric('gas_cost_usd', { precision: 18, scale: 2 }).notNull(),
  relayPaymentUsd: numeric('relay_payment_usd', { precision: 18, scale: 2 }).notNull(),
  slippageCostUsd: numeric('slippage_cost_usd', { precision: 18, scale: 2 }).notNull(),
  netProfitUsd: numeric('net_profit_usd', { precision: 18, scale: 2 }).notNull(),
  profitMarginBps: integer('profit_margin_bps').notNull(),
  accepted: boolean('accepted').notNull(),
  rejectionReason: text('rejection_reason'),
  eventToDetectMs: integer('event_to_detect_ms').notNull(),
  detectToSimMs: integer('detect_to_sim_ms').notNull(),
  simToSubmitMs: integer('sim_to_submit_ms').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').references(() => users.uid),
  action: text('action').notNull(),
  category: text('category').notNull(), // SECURITY | STRATEGY | SIMULATION | EMERGENCY | WALLET | CONTRACT
  details: text('details').notNull(),
  severity: text('severity').notNull().default('INFO'), // INFO | WARN | CRITICAL
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Non-custodial wallet session audit table (NEVER stores private keys or seed phrases)
export const walletSessions = pgTable('wallet_sessions', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').references(() => users.uid),
  walletAddress: text('wallet_address').notNull(),
  chainId: integer('chain_id').notNull(),
  chainName: text('chain_name').notNull(),
  connectorName: text('connector_name').notNull(), // MetaMask | WalletConnect | Injected EVM
  sessionStatus: text('session_status').notNull().default('CONNECTED'), // CONNECTED | DISCONNECTED | EXPIRED
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Privileged contract actions, emergency recoveries, and profit transfers with idempotency keys
export const contractActions = pgTable('contract_actions', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').references(() => users.uid),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  actionType: text('action_type').notNull(), // PAUSE | UNPAUSE | OWNERSHIP_TRANSFER | EMERGENCY_RECOVERY | PROFIT_TRANSFER | TOKEN_APPROVAL_REVOKE
  chainId: integer('chain_id').notNull(),
  contractAddress: text('contract_address').notNull(),
  callerAddress: text('caller_address').notNull(),
  recipientAddress: text('recipient_address'),
  tokenSymbol: text('token_symbol'),
  tokenAddress: text('token_address'),
  amountFormatted: text('amount_formatted'),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('AWAITING_APPROVAL'), // AWAITING_APPROVAL | SUBMITTED | CONFIRMED | FAILED | REVERTED
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Persistent off-chain bot job queue for Stop All Bots enforcement
export const botExecutionJobs = pgTable('bot_execution_jobs', {
  id: serial('id').primaryKey(),
  jobId: text('job_id').notNull().unique(),
  strategyKey: text('strategy_key').notNull(),
  tokenPair: text('token_pair').notNull(),
  status: text('status').notNull().default('QUEUED'), // QUEUED | RUNNING | CANCELLED_BY_STOP | COMPLETED
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings, {
    fields: [users.uid],
    references: [userSettings.userUid],
  }),
  strategies: many(strategies),
  simulations: many(simulations),
  auditLogs: many(auditLogs),
  walletSessions: many(walletSessions),
  contractActions: many(contractActions),
}));
