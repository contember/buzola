# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Buzola is a type-safe SPA router for React built on the browser's Navigation API. It uses a page-centric approach where each page declares itself via `createPage()` with typed params, loaders, and error handling. Type safety is achieved through TypeScript module augmentation of `BuzolaPageMap` and `BuzolaPersistentParams`.

## Repository Structure

Bun monorepo:

- `packages/buzola` — Core routing engine (`@buzola/router`) and React integration (`@buzola/router/react`)
- `packages/codegen` — Framework-agnostic file-based route scanning and type generation (`@buzola/codegen`). Ships the `buzola` CLI.
- `packages/vite-plugin` — Vite adapter (`@buzola/vite-plugin`) — thin wrapper around `@buzola/codegen`
- `packages/bun-plugin` — Bun adapter (`@buzola/bun-plugin`) — thin wrapper around `@buzola/codegen`
- `examples/vite` — Demo app using the Vite plugin
- `examples/bun` — Demo app using the Bun plugin

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
bun test packages/codegen

# Run a single test file
bun test packages/buzola/src/__tests__/router.test.ts

# Example dev servers
cd examples/vite && bun run dev   # Vite-based example
cd examples/bun && bun run dev    # Bun-based example
```

## Architecture

### Core package (`packages/buzola`)

Two export paths (conditional: Bun uses source `.ts` directly, Node/browsers use compiled `.js`):

- `@buzola/router` — Engine: `Router` class, `matchRoutes`, `buildRouteTree`, `NavigationAdapter`, route config types, Standard Schema validation
- `@buzola/router/react` — React layer: `BuzolaProvider`, `Link` (with `asChild`), `Outlet`, `ErrorBoundary`, hooks (`useRouter`, `useNavigate`, `useParams`, `useSearchParams`, `useRoute`, `useRouterState`, `useBlocker`, `useInvalidate`)

Key engine modules in `src/engine/`:

- `router.ts` — Central `Router` class managing state, navigation, subscriptions
- `matcher.ts` — URL matching via `URLPattern` API
- `route-tree.ts` — Builds `RouteNode` tree from flat route configs
- `navigation-adapter.ts` — Browser Navigation API abstraction (browser + memory adapter for tests)
- `loader-cache.ts` — Configurable LRU cache for loader data (stale-while-revalidate)
- `schema.ts` — Standard Schema integration for param validation (compatible with Zod 4, Valibot, ArkType)
- `types.ts` — Core type definitions (`RouteConfig`, `RouteMatch`, `RouterState`, etc.)

Key React modules in `src/react/`:

- `provider.tsx` — `BuzolaProvider` with global `middleware` prop for wrapping the entire route tree

Page definition in `src/define/`:

- `create-page.tsx` — `createPage()` API for declaring pages with params schema, loader, error handling, and type-safe `redirect(pageId, params)`

### Key concepts

- **File tree vs. route tree separation** — File hierarchy determines layout nesting (what components wrap what), while route patterns from `.route()` only affect URL matching. These are independent concerns.
- **Type-safe redirects** — Loaders can redirect using `redirect(pageId, params)` with full type safety via page IDs, not string URLs.
- **Persistent params** — Parameters that carry across navigations (configured via `persistentParams` plugin option).
- **View Transitions** — Support for the View Transitions API via `viewTransition` option in navigation.

### Codegen (`packages/codegen`)

Framework-agnostic. Scans `src/routes/` (configurable via `routesDir`), builds a `FileRouteNode` tree, and emits `buzola.gen.ts` (configurable via `output`) containing the route tree, page registry, and type augmentation.

File conventions: `_layout.tsx`, `_404.tsx`, `index.tsx`, `[param].tsx`, `[...slug].tsx`, `(group)/` — files prefixed with `_` are special convention files. Pages use `createPage()` to declare their params, loader, and component. `.route()` can override the URL pattern without affecting file-tree nesting.

Key modules in `src/`:

- `generate.ts` — Top-level orchestrator (`generate({ routesDir, outputPath, persistentParams, moduleLoader? })`). Default `moduleLoader` is native `import()` (works with Bun directly; for Node use Vite's `ssrLoadModule`).
- `config.ts` — Loads `buzola.config.{ts,js,mjs}` from project root.
- `cli.ts` — `buzola` bin for one-shot generation.
- `conventions.ts` — File naming convention parser.
- `generator/scanner.ts` — FS scanning.
- `generator/tree-builder.ts` — Builds `FileRouteNode` tree (two-phase: file hierarchy for nesting, route patterns for matching).
- `generator/page-extractor.ts` — Extracts `createPage()` metadata from modules.
- `generator/codegen.ts` — Code generation for `buzola.gen.ts` and type augmentation.

### Vite plugin (`packages/vite-plugin`)

Thin adapter (`@buzola/vite-plugin`) — exposes `buzolaPlugin()` for `vite.config.ts`. Wires `@buzola/codegen` into Vite: provides the `virtual:buzola/routes` virtual module, regenerates on `handleHotUpdate`, and uses Vite's `ssrLoadModule` as the module loader (required because Node can't `import()` `.ts`/`.tsx` directly). Supports named entrypoints for multi-SPA configs via `name` option.

### Bun plugin (`packages/bun-plugin`)

Thin adapter (`@buzola/bun-plugin`) — exposes `buzolaPlugin()` (a `BunPlugin`) for `Bun.build()` and `bunfig.toml` preload. Wires `@buzola/codegen` into Bun: provides the `virtual:buzola/routes` virtual module and runs `generate()` at plugin setup. Bun's native loader handles `.ts`/`.tsx`, so no custom `moduleLoader` is needed.

## Release Process

All packages (`@buzola/router`, `@buzola/codegen`, `@buzola/vite-plugin`, `@buzola/bun-plugin`) are always released together with the same version number.

To release a new version:

```bash
git tag "v<version>"
git push origin "v<version>"
```

The CI workflow (`.github/workflows/release.yml`) handles the rest — it runs lint, format check, typecheck, and tests, then publishes all packages to npm with provenance. The version in `package.json` files is a placeholder; the actual version is taken from the git tag.

## Code Style

- **Formatter:** dprint — tabs, ASI (no semicolons), single quotes, double quotes in JSX, 150 char line width
- **Linter:** Biome — recommended rules with a11y off, several complexity/correctness rules relaxed
- **Tests:** `bun:test` (imports from `bun:test`, not vitest)
- **TypeScript:** Strict mode, `verbatimModuleSyntax`, `NodeNext` module resolution with explicit `.js` extensions, composite builds with project references
- **Section markers:** Code uses `// ─── Section Name ─────` comment dividers
