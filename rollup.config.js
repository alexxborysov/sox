import terser from "@rollup/plugin-terser";
import { babel } from "@rollup/plugin-babel";
import cleaner from "rollup-plugin-cleaner";
import { dts } from "rollup-plugin-dts";
import size from "rollup-plugin-size";
import typescript from "@rollup/plugin-typescript";
import alias from "@rollup/plugin-alias";
import path from "path";

/**
 * @type {import('rollup').RollupOptions}
 */
const core_config = [
  {
    input: `packages/core/src/core.ts`,
    plugins: [
      cleaner({ targets: ["packages/core/dist"] }),
      typescript({
        tsconfig: "./tsconfig.json",
        include: ["packages/core/src/*", "packages/utils/shared-types.ts"],
        declaration: false,
        module: "ESNext",
      }),
      babel({
        babelHelpers: "bundled",
      }),
      terser(),
      size(),
    ],
    output: [
      {
        file: `packages/core/dist/sox.js`,
        format: "es",
      },
      {
        file: `packages/core/dist/sox.cjs`,
        format: "cjs",
      },
    ],
  },
  {
    input: `packages/core/src/core.ts`,
    plugins: [
      dts(),
      alias({
        entries: [
          {
            find: "~/utils",
            replacement: path.resolve("./packages/utils"),
          },
        ],
      }),
      size(),
    ],
    output: [
      {
        file: `packages/core/dist/sox.d.ts`,
        format: "es",
      },
    ],
  },
];

export default [...core_config];
