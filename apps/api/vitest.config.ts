import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Module + integration tests touch a real Postgres, so don't parallelize
    // across files — they'd race for the same `Booking` table.
    fileParallelism: false,
    // Per-test timeout: a SERIALIZABLE retry can take a moment under load.
    testTimeout: 30_000,
    // Shared bootstrap: makes sure `apps/api/.env` is loaded so module/integration
    // tests can talk to the same Docker Postgres the dev server uses.
    setupFiles: ["./tests/setup.ts"],
  },
});
