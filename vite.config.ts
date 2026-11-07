import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Unique id of this build: commit SHA in CI, timestamp locally.
const version = process.env.APP_VERSION || `local-${Date.now()}`;

/** Writes dist/version.json so running clients can detect a newer deploy. */
function versionFile(): Plugin {
  let outDir = 'dist';
  return {
    name: 'version-file',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      writeFileSync(resolve(outDir, 'version.json'), JSON.stringify({ version }));
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});
