<h1 align="center">Pre Release Checks</h1>

<p align="center">One lovely command</p>

<p align="center">
	<a href="https://github.com/Jolg42/pre-release-checks/blob/main/.github/CODE_OF_CONDUCT.md" target="_blank"><img alt="🤝 Code of Conduct: Kept" src="https://img.shields.io/badge/%F0%9F%A4%9D_code_of_conduct-kept-21bb42" /></a>
	<a href="https://github.com/Jolg42/pre-release-checks/blob/main/LICENSE.md" target="_blank"><img alt="📝 License: MIT" src="https://img.shields.io/badge/%F0%9F%93%9D_license-MIT-21bb42.svg"></a>
	<a href="http://npmjs.com/package/pre-release-checks"><img alt="📦 npm version" src="https://img.shields.io/npm/v/pre-release-checks?color=21bb42&label=%F0%9F%93%A6%20npm" /></a>
	<img alt="💪 TypeScript: Strict" src="https://img.shields.io/badge/%F0%9F%92%AA_typescript-strict-21bb42.svg" />
</p>

## Prerequisites

- `tsx`
  ```term
  npm i -g tsx
  ```
- [GitHub CLI](https://github.com/cli/cli#installation) or `GITHUB_TOKEN` env var
  - on macOS: `brew install gh`

## Usage

```shell
npx Jolg42/pre-release-checks
```

```ts
import { runChecks } from "pre-release-checks";

await runChecks();
```

### Why?

This is a script for Prisma ORM release process, documented in [a (private) Notion page](https://www.notion.so/prismaio/Prisma-ORM-Code-Release-Process-88cb8e87e1ab4358bb8ff77c70a5e330)

### Improvements

- Publish on npm?
- add post release checks
- handle patch release (needs prompt / input)
- add check for engines CI/CD (currently https://buildkite.com/prisma/release-prisma-engines/builds?branch=main)
- ...
- Any ideas?

> 💙 This package was templated with [`create-typescript-app`](https://github.com/JoshuaKGoldberg/create-typescript-app).
