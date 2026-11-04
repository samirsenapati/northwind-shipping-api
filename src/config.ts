// Runtime settings, read once from the environment. The defaults match the limits in the public docs
// and are enough to run the API locally with no configuration at all.

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive whole number, got "${raw}"`);
  }
  return value;
}

export const config = {
  port: positiveInt('PORT', 3000),
  env: process.env.NODE_ENV ?? 'development',

  // Keys this instance accepts. A hosted deployment looks keys up in the accounts service instead.
  testApiKey: process.env.NORTHWIND_TEST_KEY || 'nw_test_localdevelopment01',
  liveApiKey: process.env.NORTHWIND_LIVE_KEY ?? '',

  rateLimit: {
    perMinute: positiveInt('RATE_LIMIT_PER_MINUTE', 600),
    scalePerMinute: positiveInt('SCALE_RATE_LIMIT_PER_MINUTE', 1200),
  },

  idempotencyTtlSeconds: 24 * 60 * 60,
  labelVoidWindowDays: 30,
  returnWindowDays: positiveInt('RETURN_WINDOW_DAYS', 30),

  webhooks: {
    timeoutMs: 10_000,
    maxRetryHours: positiveInt('WEBHOOK_MAX_RETRY_HOURS', 72),
    signatureToleranceSeconds: 5 * 60,
  },
} as const;

export const DAY_SECONDS = 24 * 60 * 60;
