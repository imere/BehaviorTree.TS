[![test](https://github.com/imere/BehaviorTree.TS/actions/workflows/test.yml/badge.svg)](https://github.com/imere/BehaviorTree.TS/actions/workflows/test.yml)

# BehaviorTree.TS

A (mostly) copy & paste repo of [BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP)

## Documentation

Refer to [BehaviorTree.CPP docs](https://www.behaviortree.dev/docs/Intro)

## Usage

```sh
git clone https://github.com/imere/BehaviorTree.TS.git
```

#### Method A for TypeScript

import from `src` (explicit `.js` specifiers — the package is ESM)

```ts
import { TreeFactory, NodeStatus } from "./src/index.js";
```

#### Method B

1. run `pnpm build`
2. import from `build`:

| output       | format     | use it via                  |
| ------------ | ---------- | --------------------------- |
| `build/lib`  | ESM + types | `import` / bundlers         |
| `build/dist` | UMD        | `<script>`, `require`       |

```ts
import { TreeFactory } from "behavior-tree-ts"; // build/lib/index.js
```

```js
const { TreeFactory } = require("behavior-tree-ts"); // build/dist/index.cjs
```

## Some differences

```diff
- <root BTCPP_format=
+ <root BTTS_format=

# Only support JavaScript code
- <Script code=" value:=1 " />
+ <Script code=" value=1 " />

# Experimental syntax for entries in the root blackboard
- <Script code=" @value=1 " />
+ <Script code=" _B_value=1 " />
```

## License

Same as [BehaviorTree.CPP](https://github.com/BehaviorTree/BehaviorTree.CPP)
