import { defineConfig } from 'vitest/config';
// `npm test` runs offline unit tests; `LIVE=1 npx vitest run` runs checks against real testnet nodes.
export default defineConfig({ test: { include: process.env.LIVE ? ['scripts/live/**/*.test.ts'] : ['src/**/*.test.ts'] } });
