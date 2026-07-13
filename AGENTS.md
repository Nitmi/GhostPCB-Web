# AGENTS.md

This file gives coding agents the project-specific context needed to work on GhostPCB-Web safely and consistently.

## Project Overview

GhostPCB-Web is a pure frontend Gerber ZIP fingerprint obfuscation tool. It runs entirely in the browser: users select one `.zip` Gerber archive, choose an output count from `1` to `99`, and download one or more generated ZIP archives. User PCB files must stay local and must not be uploaded to any server.

Current stack:

- React 19 + TypeScript + Vite
- Web Worker for all archive and Gerber processing
- `fflate` for ZIP unzip/zip
- `spark-md5` for LCEDA-style signature derivation
- Vitest for core tests
- ESLint flat config

## Essential Commands

Use `pnpm`; the lockfile is `pnpm-lock.yaml`.

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm preview
```

Before finishing behavior-changing work, run at least:

```bash
pnpm test
pnpm lint
```

Run `pnpm build` when touching TypeScript config, Vite config, Worker boundaries, imports, or production-bundle-sensitive code.

## Repository Layout

```text
src/
├─ app/                         React application shell and global app styles
├─ features/gerber-process/     Gerber processing UI, state, validators, client service
├─ worker/                      Worker entrypoint, request/response protocol, handlers
├─ core/
│  ├─ gerber/                   Pure Gerber detection and transformation logic
│  ├─ zip/                      ZIP unzip/zip wrappers
│  └─ random/                   Seeded deterministic RNG utilities
├─ shared/                      Shared constants, utilities, service helpers, ambient types
└─ main.tsx                     React root
```

Other important paths:

- `README.md`: user-facing project description and usage.
- `dev-docs/`: historical implementation notes. This directory is ignored by git but useful when present locally.
- `docs/screenshot.webp`: README screenshot asset.
- `dist/` and `node_modules/`: generated/vendor output; do not edit.

## Architecture Rules

- Keep React components focused on interaction and rendering.
- Do not put ZIP parsing, Gerber parsing, coordinate rewriting, hashing, or bulk text processing in React components.
- All actual processing of user archives belongs behind the Worker path: `src/features/gerber-process/service/processClient.ts` -> `src/worker/*` -> `src/core/*`.
- Keep `src/core` DOM-free and React-free. Core functions should accept plain data and return plain data so they remain testable and replaceable by a future WASM implementation.
- Keep Worker messages typed through `src/worker/protocol.ts`.
- Use transferable `ArrayBuffer`s where practical for large generated ZIP data.
- Preserve cancellation support through `throwIfCanceled` checks in long-running loops.

## Current Product Boundary

Implement and maintain only the currently active processing behavior unless the user explicitly asks for a product expansion:

- Single Gerber `.zip` input.
- Output count clamped to `1-99`.
- Unknown ZIP entries are preserved unchanged.
- ZIP processing and Gerber text processing happen locally in the browser.
- Multiple outputs are independently generated; do not copy the same ZIP and only rename it.

Do not introduce these without explicit direction:

- Backend services, uploads, accounts, databases, queues, or SSR.
- Electron/Tauri runtime integration.
- Rust/WASM migration.
- Multi-file batch processing.
- Historical unused obfuscators such as timestamp modification, geometry perturbation, structure obfuscation, or physical-parameter tweaking.

## Gerber Processing Contract

The important pipeline is in `src/core/gerber/pipeline.ts` and `src/core/gerber/processor.ts`. Preserve these behaviors unless intentionally changing them with tests:

- Detect known Gerber types by extension in `fileTypes.ts`.
- Known types include `GTL`, `GBL`, `GTO`, `GBO`, `GTS`, `GBS`, `GTP`, `GBP`, `GKO`, `DRL`, and inner layers like `G1`/`G2`/other `G...` extensions.
- Treat unknown files as passthrough entries.
- Detect EasyEDA source from known, non-drill Gerber text containing `EasyEDA Pro`.
- Drill files must not receive EasyEDA headers, LCEDA signatures, or silkscreen shifts.
- Silkscreen shifts apply only to top/bottom silkscreen files.
- Silkscreen shifts must not modify `I`/`J` arc offsets.
- For non-EasyEDA archives, inject EasyEDA-style header comments into non-drill Gerber files unless that file already contains `EasyEDA Pro`.
- Inject one LCEDA-style aperture signature into non-drill Gerber files when valid aperture definitions exist.
- Output names must follow `Gerber_PCB{index}_YYYY-MM-DD.zip`.
- Output dates are randomized within the past `1-30` days using the seeded RNG path.

## Testing Guidance

Tests currently live beside core modules as `src/**/*.test.ts`; Vite/Vitest includes only `src/**/*.test.ts`.

Prefer adding or updating tests when changing:

- file type detection
- EasyEDA source detection
- silkscreen coordinate shifting
- `I`/`J` preservation
- header injection
- signature injection
- ZIP unzip/zip integration
- multi-output generation
- error messages for invalid input

For deterministic tests, pass fixed `Date` and fixed `seed` values into core functions. Avoid testing Worker/UI behavior when a pure core test can cover the logic more simply.

## Code Style

- TypeScript uses ESM and explicit `.ts`/`.tsx` import extensions.
- `tsconfig` has strict unused checks: remove unused locals, parameters, and imports.
- Use type-only imports for types.
- Prefer small pure helpers in `src/core` and `src/shared` over large inline component logic.
- Keep user-facing UI text in Chinese unless changing an existing English technical label.
- Preserve the existing CSS variable and class-based styling approach. Global visual tokens live in `src/index.css`; app layout/component styles live in `src/app/app.css`.
- Default to ASCII for new technical prose unless editing Chinese UI/docs where Chinese text is already expected.

## Frontend Notes

- The UI intentionally uses a glassy desktop-window visual style with responsive fallbacks.
- Preserve keyboard accessibility on custom controls such as upload dropzones.
- Do not block the main thread with archive processing.
- Browser downloads are Blob-based. Revoke object URLs after triggering downloads.
- The optional client download feature fetches release manifests from configured endpoints; do not mix this with Gerber file processing or upload user archives.

## Error Handling

Maintain clear Chinese error messages for common failures:

- non-`.zip` file selection
- ZIP unzip failure
- empty ZIP
- ZIP with no valid Gerber file
- Worker failure
- user cancellation
- unavailable client download endpoint

Do not swallow processing errors silently. Convert unknown errors to a concise user-facing fallback message at service/UI boundaries.

## Dependency Policy

- Avoid new dependencies unless they clearly reduce complexity or improve correctness.
- Do not add state management libraries for the current small UI.
- Do not add server-only packages to browser or Worker code.
- If adding a package, update `pnpm-lock.yaml` through `pnpm install`, not by hand.

## Agent Workflow

When modifying this repository:

1. Inspect relevant files first; do not assume behavior from names alone.
2. Keep edits scoped to the user request.
3. Do not edit generated output in `dist/` or vendor files in `node_modules/`.
4. Preserve existing user changes in the working tree.
5. Add tests for behavior changes in core processing.
6. Run the relevant `pnpm` checks before final response, or state clearly why they were not run.

