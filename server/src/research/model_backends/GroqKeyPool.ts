function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type GroqKeyLease = {
  key: string;
  keyId: string;
};

type KeyState = {
  key: string;
  keyId: string;
  cooldownUntil: number;
  consecutiveFailures: number;
};

export class GroqKeyPool {
  private readonly states: KeyState[];
  private cursor = 0;

  constructor(keys: string[]) {
    this.states = keys
      .map((key, index) => ({
        key,
        keyId: `groq-key-${index + 1}`,
        cooldownUntil: 0,
        consecutiveFailures: 0
      }))
      .filter((state) => state.key.trim().length > 0);
  }

  static fromEnvironment(): GroqKeyPool {
    const keysEnv = process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY ?? '';
    const keys = keysEnv
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    return new GroqKeyPool(keys);
  }

  hasKeys(): boolean {
    return this.states.length > 0;
  }

  nextAvailableInMs(): number {
    if (this.states.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const now = Date.now();
    const nextCooldown = Math.min(...this.states.map((state) => Math.max(0, state.cooldownUntil - now)));
    return nextCooldown;
  }

  async lease(): Promise<GroqKeyLease> {
    if (this.states.length === 0) {
      throw new Error('No Groq API keys configured.');
    }

    while (true) {
      const now = Date.now();
      for (let offset = 0; offset < this.states.length; offset += 1) {
        const index = (this.cursor + offset) % this.states.length;
        const state = this.states[index]!;
        if (state.cooldownUntil <= now) {
          this.cursor = (index + 1) % this.states.length;
          return { key: state.key, keyId: state.keyId };
        }
      }

      const waitMs = Math.max(50, this.nextAvailableInMs());
      await sleep(waitMs);
    }
  }

  releaseSuccess(keyId: string): void {
    const state = this.states.find((entry) => entry.keyId === keyId);
    if (!state) {
      return;
    }
    state.consecutiveFailures = 0;
    state.cooldownUntil = 0;
  }

  releaseRateLimited(keyId: string, retryAfterMs: number): void {
    const state = this.states.find((entry) => entry.keyId === keyId);
    if (!state) {
      return;
    }
    state.consecutiveFailures = 0;
    state.cooldownUntil = Date.now() + Math.max(1000, retryAfterMs);
  }

  releaseFailure(keyId: string): void {
    const state = this.states.find((entry) => entry.keyId === keyId);
    if (!state) {
      return;
    }
    state.consecutiveFailures += 1;
    const penaltyMs = Math.min(10_000, 1000 * state.consecutiveFailures);
    state.cooldownUntil = Date.now() + penaltyMs;
  }
}
