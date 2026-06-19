# Epoch Integration Demo

Sample Node.js script showing how to integrate with [Epoch Protocol](https://epochprotocol.xyz) using `@epoch-protocol/epoch-intents-sdk`. The flow mirrors the [compact-demo-epoch](https://github.com/epochprotocol/compact-demo-epoch) swap UI: build task data, fetch a quote, submit the intent, then poll for completion.

## What it does

Cross-chain **swap and bridge** on **testnet**:

| | |
|---|---|
| **Source** | Ethereum Sepolia (`11155111`) |
| **Destination** | Base Sepolia (`84532`) |
| **Default route** | USDC → USDC |
| **API** | `https://testnet-dev.epochprotocol.xyz` |

The SDK handles ERC-20 approval, Compact deposit, on-chain registration, and intent submission. Solvers execute the swap/bridge on the destination chain.

## Prerequisites

- Node.js 18+
- A Sepolia wallet with testnet USDC (or change tokens in `.env`)
- Testnet ETH on Sepolia for gas

## Setup

```bash
cd epoch-integration-demo
cp .env.example .env
# Edit .env and set PRIVATE_KEY=0x...
npm install
```

## Run

**Quote only** (no transactions):

```bash
npm run quote
```

**Full swap-and-bridge**:

```bash
npm run swap-and-bridge
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PRIVATE_KEY` | — | Required. Sponsor wallet (Sepolia) |
| `EPOCH_API_BASE_URL` | testnet URL | Epoch allocator API |
| `SEPOLIA_RPC_URL` | viem public RPC | Optional Sepolia RPC |
| `INPUT_TOKEN_SYMBOL` | `USDC` | Source token (testnet graph) |
| `OUTPUT_TOKEN_SYMBOL` | `USDC` | Destination token |
| `INPUT_AMOUNT` | `1` | Human-readable input amount |
| `SLIPPAGE_BPS` | `100` | Slippage in basis points (1%) |

## Integration flow

```
getHealthCheck()
    ↓
getTaskData({ taskType: GetTokenOut, intentData, extraData })
    ↓
getIntentQuote({ sponsorAddress, taskTypeString, intentData })
    ↓
solveIntent({ ..., quoteResult })   ← SDK approves + deposits + registers
    ↓
getIntentStatus(address, nonce)     ← poll until completed
```

See the [Epoch Intents SDK](https://github.com/epochprotocol/smallocator/tree/dev/sdk) and its `skills.md` for the full SDK reference.

## Related projects

- [compact-demo-epoch](https://github.com/epochprotocol/compact-demo-epoch) — React + wagmi UI using the same SDK
- [smallocator/sdk](https://github.com/epochprotocol/smallocator/tree/dev/sdk) — Epoch Intents SDK source

## Security

Never commit `.env` or real private keys. This demo is for testnet only.
