import { getAddress, isAddress } from "viem";
import { testnetGraph } from "@epoch-protocol/epoch-intents-sdk";

type GraphChain = { chainId: number; explorer: string };
type GraphToken = {
  contractAddress: Record<string, string>;
  decimals: number;
};
type EpochGraph = {
  chains: Record<string, GraphChain>;
  tokens: Record<string, GraphToken>;
};

const graph = testnetGraph as EpochGraph;

/** Map viem chain IDs to Epoch testnet graph chain names */
const CHAIN_ID_TO_GRAPH_NAME: Record<number, string> = {
  11155111: "Mainnet", // Sepolia
  84532: "Base", // Base Sepolia
  11155420: "Optimism", // Optimism Sepolia
};

export function getGraphChainName(chainId: number): string {
  const name = CHAIN_ID_TO_GRAPH_NAME[chainId];
  if (!name) {
    throw new Error(`Unsupported chain ID for testnet graph: ${chainId}`);
  }
  return name;
}

export function getTokenForChain(symbol: string, chainId: number) {
  const chainName = getGraphChainName(chainId);
  const token = graph.tokens[symbol];
  if (!token) {
    throw new Error(`Token symbol not in testnet graph: ${symbol}`);
  }

  const rawAddress =
    token.contractAddress[chainName] ?? token.contractAddress["*"];
  if (!rawAddress || rawAddress === "*") {
    throw new Error(
      `${symbol} has no contract address for ${chainName} (chainId ${chainId})`,
    );
  }

  const address = isAddress(rawAddress) ? getAddress(rawAddress) : rawAddress;

  return {
    symbol,
    address,
    decimals: token.decimals,
    chainName,
  };
}

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(slippageBps, 10_000)));
  return (amount * (10_000n - bps)) / 10_000n;
}
