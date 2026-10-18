import { ProfitValidationBreakdown, ProfitValidationInput } from '../types/arbitrage.ts';

/**
 * Deterministic Profit Validator using integer-safe BigInt arithmetic (scaled to 1e6 micro-USD
 * and exact token base units `10^decimals`).
 *
 * Formula enforced:
 * net profit = final output value - borrowed principal value - flash-loan fee - DEX fees
 *              - gas cost - applicable relay or builder payment - other execution costs.
 */
const SCALE = 1_000_000n;
const BPS_DIVISOR = 10_000n;

function toScaledBigInt(amountUsd: number): bigint {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) return 0n;
  return BigInt(Math.round(amountUsd * 1_000_000));
}

function fromScaledBigInt(val: bigint): number {
  return Number(val) / 1_000_000;
}

export function validateArbitrageOpportunity(
  input: ProfitValidationInput
): ProfitValidationBreakdown {
  const rejectionReasons: string[] = [];

  // 1. Validate required inputs and bounds
  if (!Number.isFinite(input.borrowAmountUsd) || input.borrowAmountUsd <= 0) {
    rejectionReasons.push('Missing or non-positive borrow principal amount.');
  }
  if (input.borrowAmountUsd < input.minBorrowUsd || input.borrowAmountUsd > input.maxBorrowUsd) {
    rejectionReasons.push(
      `Borrow amount ($${input.borrowAmountUsd.toLocaleString()}) is outside configured bounds ($${input.minBorrowUsd.toLocaleString()} – $${input.maxBorrowUsd.toLocaleString()}).`
    );
  }
  if (input.hopCount <= 0 || input.hopCount > input.maxHops) {
    rejectionReasons.push(
      `Route hop count (${input.hopCount}) exceeds maximum permitted hops (${input.maxHops}).`
    );
  }

  // 2. Check data freshness (stale data rejection)
  if (input.snapshotAgeSec > input.staleDataThresholdSec) {
    rejectionReasons.push(
      `Stale pool state rejected: snapshot age (${input.snapshotAgeSec}s) exceeds threshold (${input.staleDataThresholdSec}s).`
    );
  }

  // 3. Check contract pause, router allowlist, token support, and reentrancy guards
  if (input.contractPaused) {
    rejectionReasons.push(
      'Contract execution blocked: FlashAIArbitrageExecutor is currently PAUSED.'
    );
  }
  if (input.routerApproved === false) {
    rejectionReasons.push(
      'Security abort: Candidate route includes an unapproved DEX router address.'
    );
  }
  if (input.tokenSupported === false) {
    rejectionReasons.push(
      'Security abort: Candidate route includes a token not on the contract supportedTokens allowlist.'
    );
  }
  if (input.reentrancyDetected) {
    rejectionReasons.push(
      'Security abort: Reentrancy guard triggered during callback simulation.'
    );
  }
  if (input.callbackAuthorized === false) {
    rejectionReasons.push(
      'Security abort: Unauthorized flash-loan callback caller or untrusted initiator.'
    );
  }
  if (input.swapReverted) {
    rejectionReasons.push(
      'Swap simulation reverted: Insufficient pool liquidity or router execution failure.'
    );
  }

  // 4. Check slippage and price impact bounds
  if (input.priceImpactBps > input.maxPriceImpactBps) {
    rejectionReasons.push(
      `Price impact (${(input.priceImpactBps / 100).toFixed(2)}%) exceeds maximum allowed (${(
        input.maxPriceImpactBps / 100
      ).toFixed(2)}%).`
    );
  }
  if (input.expectedSlippageBps > input.maxSlippageBps) {
    rejectionReasons.push(
      `Estimated slippage (${(input.expectedSlippageBps / 100).toFixed(2)}%) exceeds limit (${(
        input.maxSlippageBps / 100
      ).toFixed(2)}%).`
    );
  }

  // 5. Integer-safe BigInt arithmetic for all financial values
  const principalScaled = toScaledBigInt(input.borrowAmountUsd);
  const decimals = Math.max(0, Math.min(18, Math.floor(input.tokenDecimals || 18)));
  const tokenMultiplier = 10n ** BigInt(decimals);
  const borrowPrincipalTokenUnits = ((principalScaled * tokenMultiplier) / SCALE).toString();

  const grossSpreadBpsBig = BigInt(Math.max(0, Math.round(input.grossSpreadBps)));
  const flashLoanFeeBpsBig = BigInt(Math.max(0, Math.round(input.flashLoanFeeBps)));
  const dexFeeBpsBig = BigInt(Math.max(0, Math.round(input.dexFeeBpsTotal)));
  const priceImpactBpsBig = BigInt(Math.max(0, Math.round(input.priceImpactBps)));
  const slippageBpsBig = BigInt(Math.max(0, Math.round(input.expectedSlippageBps)));

  const grossSpreadScaled = (principalScaled * grossSpreadBpsBig) / BPS_DIVISOR;
  const grossOutputBeforeCostsScaled = principalScaled + grossSpreadScaled;

  const flashLoanFeeScaled = (principalScaled * flashLoanFeeBpsBig) / BPS_DIVISOR;
  const dexFeesScaled = (principalScaled * dexFeeBpsBig) / BPS_DIVISOR;
  const priceImpactCostScaled = (principalScaled * priceImpactBpsBig) / BPS_DIVISOR;
  const slippageCostScaled = (principalScaled * slippageBpsBig) / BPS_DIVISOR;

  const gasEth = (input.gasLimitUnits * input.gasPriceGwei) / 1e9;
  const gasCostUsdRaw = gasEth * input.ethPriceUsd;
  const gasCostScaled = toScaledBigInt(gasCostUsdRaw);

  const relayTipScaled = toScaledBigInt(input.relayBuilderTipUsd);
  const otherCostsScaled = toScaledBigInt(input.otherExecutionCostsUsd);

  const finalOutputAfterSwapScaled = input.swapReverted
    ? 0n
    : grossOutputBeforeCostsScaled - dexFeesScaled - priceImpactCostScaled - slippageCostScaled;

  const requiredRepaymentScaled = principalScaled + flashLoanFeeScaled;
  const repaymentProven =
    !input.swapReverted &&
    !input.reentrancyDetected &&
    !input.contractPaused &&
    input.routerApproved !== false &&
    input.tokenSupported !== false &&
    input.callbackAuthorized !== false &&
    finalOutputAfterSwapScaled >= requiredRepaymentScaled;

  if (!repaymentProven && !input.swapReverted) {
    rejectionReasons.push(
      `Insufficient repayment proof: Post-swap output ($${fromScaledBigInt(
        finalOutputAfterSwapScaled
      ).toFixed(2)}) is less than required principal + flash-loan fee ($${fromScaledBigInt(
        requiredRepaymentScaled
      ).toFixed(2)}).`
    );
  }

  const maxGasScaled = toScaledBigInt(input.maxGasUsd);
  if (gasCostScaled > maxGasScaled) {
    rejectionReasons.push(
      `Estimated gas cost ($${fromScaledBigInt(gasCostScaled).toFixed(
        2
      )}) exceeds configured maximum ($${input.maxGasUsd.toFixed(2)}).`
    );
  }

  const totalCostsScaled =
    flashLoanFeeScaled +
    dexFeesScaled +
    priceImpactCostScaled +
    slippageCostScaled +
    gasCostScaled +
    relayTipScaled +
    otherCostsScaled;

  const netProfitScaled = input.swapReverted
    ? -(gasCostScaled + otherCostsScaled)
    : finalOutputAfterSwapScaled -
      principalScaled -
      flashLoanFeeScaled -
      gasCostScaled -
      relayTipScaled -
      otherCostsScaled;

  const netProfitUsd = fromScaledBigInt(netProfitScaled);
  const profitMarginBps =
    principalScaled > 0n ? Number((netProfitScaled * BPS_DIVISOR) / principalScaled) : 0;
  const profitMarginPct = profitMarginBps / 100;

  const minNetProfitScaled = toScaledBigInt(input.minNetProfitUsd);
  if (netProfitScaled < minNetProfitScaled) {
    rejectionReasons.push(
      `Estimated net profit ($${netProfitUsd.toFixed(
        2
      )}) is below minimum required threshold ($${input.minNetProfitUsd.toFixed(2)}).`
    );
  }
  if (profitMarginPct < input.minNetProfitPct) {
    rejectionReasons.push(
      `Net profit margin (${profitMarginPct.toFixed(
        3
      )}%) is below minimum required percentage (${input.minNetProfitPct.toFixed(3)}%).`
    );
  }

  const accepted = rejectionReasons.length === 0 && repaymentProven && netProfitScaled > 0n;

  return {
    accepted,
    statusStage: accepted ? 'SIMULATED_ACCEPTED' : 'SIMULATED_REJECTED',
    rejectionReasons,
    borrowPrincipalUsd: fromScaledBigInt(principalScaled),
    borrowPrincipalTokenUnits,
    grossSpreadUsd: fromScaledBigInt(grossSpreadScaled),
    grossOutputBeforeCostsUsd: fromScaledBigInt(grossOutputBeforeCostsScaled),
    flashLoanFeeUsd: fromScaledBigInt(flashLoanFeeScaled),
    dexFeesUsd: fromScaledBigInt(dexFeesScaled),
    priceImpactCostUsd: fromScaledBigInt(priceImpactCostScaled),
    slippageCostUsd: fromScaledBigInt(slippageCostScaled),
    gasCostUsd: fromScaledBigInt(gasCostScaled),
    relayBuilderTipUsd: fromScaledBigInt(relayTipScaled),
    otherExecutionCostsUsd: fromScaledBigInt(otherExecutionCostsUsd(input)),
    totalCostsUsd: fromScaledBigInt(totalCostsScaled),
    finalOutputAfterSwapUsd: fromScaledBigInt(finalOutputAfterSwapScaled),
    requiredRepaymentUsd: fromScaledBigInt(requiredRepaymentScaled),
    repaymentProven,
    netProfitUsd,
    profitMarginBps,
    profitMarginPct,
    confidenceLimitations: [
      'Simulated output assumes current block state; mempool state transitions prior to inclusion can alter reserves.',
      'Gas cost is estimated at current baseFee + priorityFee and may fluctuate up to 12.5% per block.',
      'Estimates represent deterministic simulation calculations and are never guaranteed profit.',
    ],
    calculationFormula:
      'Net Profit = Final Swap Output (after DEX Fees, Price Impact & Slippage) − Borrowed Principal − Flash-Loan Fee − Gas Cost − Relay/Builder Tip − Other Execution Costs',
  };
}

function otherExecutionCostsUsd(input: ProfitValidationInput): bigint {
  return toScaledBigInt(input.otherExecutionCostsUsd);
}
