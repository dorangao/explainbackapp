import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// Component and TypeScript unit tests. Node engine/HTTP tests stay on `node --test`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["frontend/**/*.test.{ts,tsx}"],
    globals: false,
    css: false,
  },
});
