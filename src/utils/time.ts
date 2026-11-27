export const DAY_MS = 86_400_000;

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
