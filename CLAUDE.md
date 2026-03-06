# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Buzola is a type-safe SPA router for React built on the browser's Navigation API. It supports both file-based (Next.js-like) and config-based routing with full TypeScript type safety via module augmentation.

## Repository Structure

Bun monorepo with three workspaces:

- `packages/buzola` — Core routing engine (`buzola`) and React integration (`buzola/react`)
- `packages/vite-plugin` — Vite plugin (`@buzola/vite-plugin`) for file-based route scanning and type generation
- `playground` — Demo app using config-based routing

## Common Commands

```bash
# Install dependencies
bun install

# Lint and format
bun run lint          # Biome lint
bun run lint:fix      # Biome lint with auto-fix
bun run format        # dprint format
bun run format:check  # dprint check

# Type check (uses project references)
bun run typecheck

# Run all tests in a package
bun test packages/buzola
bun test packages/vite-plugin

# Run a single test file
bun test packages/buzola/src/__tests__/router.test.ts

# Playground dev server
cd playground && bun run dev
```

## Architecture

### Core package (`packages/buzola`)

Two export paths:

- `buzola` — Engine: `Router` class, `matchRoutes`, `buildRouteTree`, `NavigationAdapter`, route config types
- `buzola/react` — React layer: `BuzolaProvider`, `Link`, `Outlet`, hooks (`useRouter`, `useNavigate`, `useParams`, `useSearchParams`, `useRoute`, `useBlocker`)

Key engine modules in `src/engine/`:

- `router.ts` — Central `Router` class managing state, navigation, subscriptions
- `matcher.ts` — URL matching via `URLPattern` API
- `route-tree.ts` — Builds `RouteNode` tree from flat route configs
- `navigation-adapter.ts` — Browser Navigation API abstraction (also has memory adapter for tests)
- `types.ts` — Core type definitions (`RouteConfig`, `RouteMatch`, `RouterState`, etc.)

Type safety works through TypeScript module augmentation of `BuzolaRouteMap` — generated code extends this interface so `Link`, `useNavigate`, `useParams` etc. are fully typed.

### Vite plugin (`packages/vite-plugin`)

Two modes:

1. **File-based** (default) — Scans `src/routes/`, generates route tree as virtual module `virtual:buzola/routes`
2. **Config-based** (`routeConfigFile` option) — Parses explicit route config, only generates type augmentation

File conventions: `_layout.tsx`, `_404.tsx`, `index.tsx`, `[param].tsx`, `[...slug].tsx`, `(group)/` — files prefixed with `_` are special convention files

Key modules in `src/`:

- `plugin.ts` — Vite plugin entry
- `conventions.ts` — File naming convention parser
- `generator/scanner.ts` — FS scanning
- `generator/tree-builder.ts` — Builds `FileRouteNode` tree
- `generator/codegen.ts` — Code generation for `buzola.gen.ts` and type augmentation
- `generator/config-parser.ts` — Extracts routes from config-based definitions

## Code Style

- **Formatter:** dprint — tabs, ASI (no semicolons), single quotes, double quotes in JSX, 150 char line width
- **Linter:** Biome — recommended rules with a11y off, several complexity/correctness rules relaxed
- **Tests:** `bun:test` (imports from `bun:test`, not vitest)
- **TypeScript:** Strict mode, `verbatimModuleSyntax`, composite builds with project references
- **Section markers:** Code uses `// ─── Section Name ─────` comment dividers
