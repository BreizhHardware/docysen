import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      // main.ts ne fait que le bootstrap (fastify.listen, process.exit) : rien à unit-tester,
      // ce serait un test d'intégration à part entière.
      exclude: ["src/main.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
