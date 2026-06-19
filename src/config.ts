import "dotenv/config";

/** Sepolia testnet — source chain for deposits */
export const SOURCE_CHAIN_ID = 11155111;

/** Base Sepolia — testnet destination (Epoch graph key: "Base") */
export const DESTINATION_CHAIN_ID = 84532;

export const TESTNET_API_BASE_URL =
  process.env.EPOCH_API_BASE_URL ??
  "https://epochintentsdev.epochprotocol.xyz";

export const INPUT_TOKEN_SYMBOL = process.env.INPUT_TOKEN_SYMBOL ?? "USDC";
export const OUTPUT_TOKEN_SYMBOL = process.env.OUTPUT_TOKEN_SYMBOL ?? "USDC";
export const INPUT_AMOUNT = process.env.INPUT_AMOUNT ?? "1";
/** Slippage in basis points (100 = 1%) */
export const SLIPPAGE_BPS = Number(process.env.SLIPPAGE_BPS ?? "100");

export const ZERO_PROTOCOL_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export function requirePrivateKey(): `0x${string}` {
  const key = process.env.PRIVATE_KEY;
  if (!key?.startsWith("0x")) {
    throw new Error(
      "Set PRIVATE_KEY in .env (0x-prefixed hex). Never commit real keys.",
    );
  }
  return key as `0x${string}`;
}

export function getSepoliaRpcUrl(): string | undefined {
  return process.env.SEPOLIA_RPC_URL;
}
