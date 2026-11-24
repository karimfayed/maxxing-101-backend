import { existsSync } from 'node:fs';

/** Adds `.env` to the environment, if there is one. Anything already set wins. */
export function loadEnv(): NodeJS.ProcessEnv {
  if (existsSync('.env')) process.loadEnvFile('.env');
  return process.env;
}
