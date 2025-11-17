import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: [
        'node_modules/**',
        'docs/**',
        'coverage/**',
        'tests/**',
        '**/*.test.js',
        '**/*.spec.js',
        'src/index.js', // MCP server entry point - requires integration testing
      ],
      thresholds: {
        statements: 80,
        branches: 65, // Relaxed for optional parameters, error handling, and XML parsing branches
        functions: 80,
        lines: 80,
      },
    },
  },
});
