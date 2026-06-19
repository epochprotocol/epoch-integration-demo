/**
 * Epoch swap-and-bridge demo (testnet)
 *
 * Mirrors the flow in compact-demo-epoch BalancePage:
 *   1. Health check
 *   2. getTaskData (GetTokenOut)
 *   3. getIntentQuote
 *   4. solveIntent (deposit + register + submit intent)
 *   5. Poll intent status until complete
 *
 * Example: swap/bridge USDC on Sepolia → PENGU on Base Sepolia.
 *
 * Usage:
 *   cp .env.example .env   # set PRIVATE_KEY
 *   npm install
 *   npm run quote          # quote only, no on-chain tx
 *   npm run swap-and-bridge
 */
import {
  CompactSDKError,
  EpochIntentSDK,
  TaskType,
  type IntentQuoteResult,
  type SolveIntentParams,
  type TransactionExecutionStatus,
} from "@epoch-protocol/epoch-intents-sdk";
import {
  createWalletClient,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  DESTINATION_CHAIN_ID,
  DEFAULT_SEPOLIA_RPC_URL,
  INPUT_AMOUNT,
  INPUT_TOKEN_SYMBOL,
  OUTPUT_TOKEN_SYMBOL,
  requirePrivateKey,
  SLIPPAGE_BPS,
  SOURCE_CHAIN_ID,
  TESTNET_API_BASE_URL,
  ZERO_PROTOCOL_HASH,
  getSepoliaRpcUrl,
} from "./config.js";
import { pollIntentStatus } from "./helpers/poll-intent-status.js";
import { applySlippage, getTokenForChain } from "./helpers/tokens.js";

const quoteOnly = process.argv.includes("--quote-only");

function logExecutionStatus(status: TransactionExecutionStatus) {
  console.log("[execution]", {
    phase: status.phase,
    tx: status.transactionIndex + 1,
    of: status.totalTransactions,
    chainId: status.chainId,
    hash: status.transactionHash,
    attempt: status.attempt,
    remainingMs: status.remainingMs,
    error: status.error,
  });
}

async function main() {
  const privateKey = requirePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const inputToken = getTokenForChain(INPUT_TOKEN_SYMBOL, SOURCE_CHAIN_ID);
  const outputToken = getTokenForChain(
    OUTPUT_TOKEN_SYMBOL,
    DESTINATION_CHAIN_ID,
  );

  const tokenInAmount = parseUnits(INPUT_AMOUNT, inputToken.decimals);
  const sepoliaRpc = getSepoliaRpcUrl();

  console.log("Epoch swap-and-bridge demo (testnet)");
  console.log("====================================");
  console.log(`API:         ${TESTNET_API_BASE_URL}`);
  console.log(`Sponsor:     ${account.address}`);
  console.log(
    `Route:       ${inputToken.symbol} on Sepolia (${SOURCE_CHAIN_ID}) → ${outputToken.symbol} on Base Sepolia (${DESTINATION_CHAIN_ID})`,
  );
  console.log(`Input:       ${INPUT_AMOUNT} ${inputToken.symbol}`);
  console.log(`Slippage:    ${SLIPPAGE_BPS / 100}%`);
  console.log(
    `Sepolia RPC: ${sepoliaRpc === DEFAULT_SEPOLIA_RPC_URL ? `${sepoliaRpc} (default)` : sepoliaRpc}`,
  );
  console.log(`Mode:        ${quoteOnly ? "quote-only" : "full execution"}`);
  console.log("");

  const sepoliaChain = {
    ...sepolia,
    rpcUrls: {
      ...sepolia.rpcUrls,
      default: { http: [sepoliaRpc] },
    },
  };

  const walletClient = createWalletClient({
    account,
    chain: sepoliaChain,
    transport: http(sepoliaRpc),
  });

  const sdk = new EpochIntentSDK({
    apiBaseUrl: TESTNET_API_BASE_URL,
    // Cast matches compact-demo-epoch — viem types can differ across linked packages
    walletClient: walletClient as any,
  });

  // 1. Health check — always read allocator from API, not hard-coded constants
  const health = await sdk.getHealthCheck();
  console.log("Health:", {
    status: health.status,
    allocatorAddress: health.allocatorAddress,
    signingAddress: health.signingAddress,
  });
  console.log("");

  // 2. Build mandate / task data (same shape as compact-demo-epoch BalancePage)
  const { taskTypeString, intentData } = await sdk.getTaskData({
    taskType: TaskType.GetTokenOut,
    intentData: {
      isNative: false,
      depositTokenAddress: inputToken.address,
      tokenInAmount: tokenInAmount.toString(),
      outputTokenAddress: outputToken.address,
      // Placeholder min out; quote may refine this for reverse quotes
      minTokenOut: applySlippage(tokenInAmount, SLIPPAGE_BPS).toString(),
      destinationChainId: String(DESTINATION_CHAIN_ID),
      protocolHashIdentifier: ZERO_PROTOCOL_HASH,
      recipient: account.address,
    },
    extraDataTypestring: "",
    extraData: {},
  });

  console.log("Task type string:", taskTypeString);
  console.log("Intent mandate:", intentData);
  console.log("");

  // 3. Fetch quote before submitting (required by solveIntent in current SDK)
  const quoteResult: IntentQuoteResult = await sdk.getIntentQuote({
    sponsorAddress: account.address,
    taskTypeString,
    intentData,
    isNative: false,
  });

  console.log("Quote:", {
    resourceLockRequired: quoteResult.resourceLockRequired,
    tokenIn: quoteResult.tokenIn,
    tokenOut: quoteResult.tokenOut,
    tokenInSymbol: quoteResult.tokenInSymbol,
    tokenInDecimals: quoteResult.tokenInDecimals,
    path: quoteResult.path,
    executionTxCount: quoteResult.transactions?.length ?? 0,
  });

  if (quoteResult.tokenOut) {
    console.log(
      `Expected output (raw): ${quoteResult.tokenOut} (${formatUnits(BigInt(quoteResult.tokenOut), outputToken.decimals)} ${outputToken.symbol})`,
    );
  }
  console.log("");

  if (quoteOnly) {
    console.log("Quote-only mode — stopping before solveIntent.");
    return;
  }

  if (quoteResult.tokenOut) {
    intentData.minTokenOut = applySlippage(
      BigInt(quoteResult.tokenOut),
      SLIPPAGE_BPS,
    ).toString();
    console.log(`Min token out (after quote + slippage): ${intentData.minTokenOut}`);
    console.log("");
  }

  // 4. Execute: approve (if needed) + deposit + register + submit intent
  const solveParams: SolveIntentParams = {
    isNative: false,
    sponsorAddress: account.address,
    taskTypeString,
    intentData,
    quoteResult,
    onExecutionStatus: logExecutionStatus,
  };

  const result = await sdk.solveIntent(solveParams);

  if (!("submittedIntentData" in result)) {
    console.log(
      "Reused existing resource lock — direct execution path:",
      result,
    );
    return;
  }

  if (result.depositResult?.transactionHash) {
    console.log("Deposit tx:", result.depositResult.transactionHash);
  }

  const nonce =
    result.submittedIntentData?.nonce?.toString() ?? result.nonce?.toString();

  if (!nonce) {
    console.log("Intent submitted but no nonce returned:", result);
    return;
  }

  console.log("Intent submitted. Nonce:", nonce);
  console.log("");

  // 5. Poll until solver completes on destination chain
  const finalStatus = await pollIntentStatus(sdk, account.address, nonce);
  console.log("");
  console.log("Intent completed:", finalStatus);
}

main().catch((error) => {
  if (error instanceof CompactSDKError) {
    console.error("Epoch SDK error:", error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
