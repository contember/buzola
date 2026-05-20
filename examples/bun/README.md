# Buzola — Bun example

Minimal SPA wired up with [`@buzola/bun-plugin`](../../packages/bun-plugin) and `Bun.serve()`.

## Scripts

| Command               | What it does                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `bun run build`       | One-shot `Bun.build()` with `@buzola/bun-plugin`, writes a static bundle to `dist/`.                                  |
| `bun run build:watch` | Same as `build`, re-runs on source changes (`bun --watch`).                                                           |
| `bun run start`       | Serves `dist/` over HTTP with an SPA fallback (unknown paths without an extension fall back to `index.html`).         |
| `bun run dev`         | Convenience: one-shot build, then `start`. For live source iteration, run `build:watch` and `start` in two terminals. |

## Why a separate build step?

In Bun 1.3.14 the HTML bundler used by `Bun.serve({ routes: { "/*": htmlImport } })` does **not** pick up plugins registered via `Bun.plugin()` (verified — even a trivial test plugin's `onResolve` is ignored). Until Bun adds plugin support to its dev server, we run `Bun.build()` explicitly with `plugins: [await buzolaPlugin()]` and serve the resulting `dist/` statically.

When Bun closes that gap, this example will collapse to a single `server.ts` doing `Bun.serve({ routes: { "/*": (await import("./index.html")).default } })` with the plugin preloaded.
