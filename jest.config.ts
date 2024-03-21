import { type Config } from "jest";

export default {
  rootDir: ".",
  testEnvironment: "node",
  preset: "ts-jest",
  testRegex: /\.test\.ts$/.source,
  transformIgnorePatterns: ["\\\\node_modules\\\\"],
  // moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
  //   prefix: "<rootDir>/",
  // }),
  globals: {
    "ts-jest": {
      tsConfig: "tsconfig.jest.json",
    },
  },
} as Config;
