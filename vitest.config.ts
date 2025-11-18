import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    coverage: {
      // Include covered and uncovered files matching this pattern:
      include: ['index.ts', 'src/**.{js,jsx,ts,tsx}', 'test/**.{js,jsx,ts,tsx}'],

      // Exclusion is applied for the files that match include pattern above
      // No need to define root level *.config.ts files or node_modules, as we didn't add those in include
      // exclude: ['**/some-pattern/**'],
    },
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  }
})
