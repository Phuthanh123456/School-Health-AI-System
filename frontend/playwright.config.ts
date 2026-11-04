import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  testMatch: /\.spec\.(?:ts|tsx|js)$/,
  use: { baseURL: 'http://127.0.0.1:5174' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', env: { VITE_API_URL: 'http://127.0.0.1:18081' }, reuseExistingServer: false },
  // Deliberately use a separate configured API origin to catch hardcoded fetches.
})
