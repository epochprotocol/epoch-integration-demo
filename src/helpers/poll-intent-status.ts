import type { EpochIntentSDK, IntentTransactionStatus } from "@epoch-protocol/epoch-intents-sdk";

const TERMINAL_STATUSES = new Set(["completed", "finalized", "success"]);

export async function pollIntentStatus(
  sdk: EpochIntentSDK,
  userAddress: string,
  nonce: string,
  options?: { intervalMs?: number; maxAttempts?: number },
): Promise<IntentTransactionStatus[]> {
  const intervalMs = options?.intervalMs ?? 3_000;
  const maxAttempts = options?.maxAttempts ?? 60;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const statuses = await sdk.getIntentStatus(userAddress, nonce);
    console.log(`[poll ${attempt}/${maxAttempts}]`, statuses);

    if (statuses.some((s) => TERMINAL_STATUSES.has(s.status.toLowerCase()))) {
      return statuses;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Intent did not complete after ${maxAttempts} polls`);
}
