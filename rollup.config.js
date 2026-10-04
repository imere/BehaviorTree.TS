import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

function transpile() {
  return typescript({
    tsconfig: "tsconfig.base.json",
    compilerOptions: {
      module: "ESNext",
      moduleResolution: "bundler",
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
      outDir: "build",
      tsBuildInfoFile: "build/tsconfig.rollup.tsbuildinfo",
    },
    noCheck: true,
    noForceEmit: true,
    cacheDir: "build/.rollup.cache",
  });
}

export default [
  {
    input: "src/index.ts",
    external: ["htmlparser2"],
    output: {
      file: "build/lib/index.js",
      format: "es",
      sourcemap: true,
    },
    plugins: [transpile()],
  },
  {
    input: "src/index.ts",
    output: {
      file: "build/dist/index.cjs",
      format: "umd",
      name: "BehaviorTree",
      exports: "named",
      sourcemap: true,
    },
    plugins: [transpile(), nodeResolve()],
  },
];
