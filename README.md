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

import from `src`

#### Method B

1. run `yarn build`
2. import from `dist`

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
