import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/v2.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2022",
})
