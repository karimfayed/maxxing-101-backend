export interface AppConfig {
  port: number;
  anthropicApiKey: string | null;
  claudeModel: string;
  requestsPerMinute: number;
  requestsPerDay: number;
  claudeCallsPerDay: number;
  trustProxyHops: number;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    port: wholeNumber(env, 'PORT', 3000),
    anthropicApiKey: text(env, 'ANTHROPIC_API_KEY'),
    claudeModel: text(env, 'CLAUDE_MODEL') ?? 'claude-opus-5-5',
    requestsPerMinute: wholeNumber(env, 'REQUESTS_PER_MINUTE', 30),
    requestsPerDay: wholeNumber(env, 'REQUESTS_PER_DAY', 100),
    claudeCallsPerDay: wholeNumber(env, 'CLAUDE_CALLS_PER_DAY', 1000),
    trustProxyHops: wholeNumber(env, 'TRUST_PROXY_HOPS', 0),
  };
}

function text(env: NodeJS.ProcessEnv, name: string): string | null {
  return env[name]?.trim() || null;
}

function wholeNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = text(env, name);
  if (value === null) return fallback;
  // The value is left out of the message: a secret pasted on the wrong line must not reach the logs.
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number, 0 or more`);
  return Number(value);
}
