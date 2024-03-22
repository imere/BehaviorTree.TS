import { type Config } from "jest";

export default {
  rootDir: ".",
  testEnvironment: "node",
  transform: {
    [/.ts$/.source]: ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  testRegex: /\.test\.ts$/.source,
  transformIgnorePatterns: [/\\node_modules\\/.source],
} as Config;
