export const DAY_MS = 86_400_000;

/** Resolves after `ms`; for pauses between two steps of an async flow. */
export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
