export default defineConfig({
  test: {
    coverage: {
      // Include covered and uncovered files matching this pattern:
      include: ['packages/**/src/**.{js,jsx,ts,tsx}'],

      // Exclusion is applied for the files that match include pattern above
      // No need to define root level *.config.ts files or node_modules, as we didn't add those in include
      exclude: ['**/some-pattern/**'],

      // These options are removed now
      all: true,
      extensions: ['js', 'ts'],
    }
  }
})