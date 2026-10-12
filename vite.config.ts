import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// Commit + build date, shown in the ?perf diagnostics log so reports can be matched to a build.
function buildId() {
  let rev = 'unknown'
  try {
    rev = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    // not a git checkout
  }
  return `${rev} ${new Date().toISOString().slice(0, 16)}Z`
}

// base: './' keeps asset URLs relative so the build works under GitHub Pages sub-paths.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(buildId()) },
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
