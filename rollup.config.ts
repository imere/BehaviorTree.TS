import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import type { RollupOptions } from "rollup";

const typescriptTranspile = (cacheName: string) =>
  typescript({
    tsconfig: "tsconfig.base.json",
    compilerOptions: {
      module: "ESNext",
      moduleResolution: "bundler",
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
      outDir: "build",
    },
    noCheck: true,
    noForceEmit: true,
    cacheDir: `build/.rollup.cache.${cacheName}`,
  });

// ES5 is the last version before modules, and the UMD build is the one loaded by
// a plain <script> tag, so that is the floor it has to reach: async/await,
// optional chaining, nullish coalescing, class fields and every other post-ES5
// syntax are parse errors there and take the whole file down with them.
//
// The plugin runs over the rendered chunk rather than over the input files,
// which is the point: a transpiler hooked into the module pipeline only ever
// sees this project's sources, and rollup copies third party JavaScript into the
// bundle verbatim, so htmlparser2 would have shipped at whatever level it was
// published at. Babel here sees everything that ends up in the output.
const umd = (): ReturnType<typeof getBabelOutputPlugin> =>
  getBabelOutputPlugin({
    // the output format is umd, which the plugin would otherwise refuse
    allowAllFormats: true,
    presets: [["@babel/preset-env", { targets: { ie: "11" }, modules: false }]],
  });

const config: RollupOptions[] = [
  {
    input: "src/index.ts",
    external: ["htmlparser2"],
    output: {
      file: "build/lib/index.js",
      format: "es",
      sourcemap: true,
    },
    // TypeScript emits the declarations, so it has to run over the sources
    plugins: [typescriptTranspile("esm")],
  },
  {
    input: "src/index.ts",
    output: {
      file: "build/dist/index.cjs",
      format: "umd",
      name: "BehaviorTree",
      exports: "named",
      sourcemap: true,
      plugins: [umd()],
    },
    // TypeScript is still needed here to resolve the ".js" specifiers the
    // sources use, even though Babel is what down-levels the result
    plugins: [typescriptTranspile("umd"), nodeResolve()],
  },
];

export default config;
