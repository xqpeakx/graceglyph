# Contributing to graceglyph

Thanks for considering a contribution. graceglyph is in active development
toward v1.0; the [`ROADMAP.md`](./ROADMAP.md) describes the direction.

## Development setup

```bash
git clone https://github.com/<owner>/graceglyph.git
cd graceglyph
npm install
npm test
```

Node 18 or newer is required.

## Day-to-day workflow

```bash
npm run build           # one-shot tsc build
npm run watch           # incremental tsc
npm test                # node --test on the test/ tree
npm run example:showcase   # full demo app
npm run dev:showcase    # demo app in --watch mode
```

Type-check the whole tree before opening a PR:

```bash
npx tsc -p tsconfig.json --noEmit
```

## Code style

- TypeScript strict mode is non-negotiable. New code must compile cleanly.
- Prefer composition over inheritance. Components are pure functions.
- No `any` without a `// reason:` comment. Prefer `unknown` and narrow.
- No string-based dynamic code (`eval`, `new Function`, template execution).
- Public exports must have TSDoc on every symbol.
- Internal-only modules live under `src/_internal/` and are excluded from
  the package `exports` map.

Run formatters and linters before committing:

```bash
npm run lint
npm run format
```

## Tests

Every PR that changes behavior needs tests. The test layout:

- `test/*.test.ts` — black-box tests against the public API
- Integration tests that need a fake terminal use `renderTestApp` from
  `graceglyph/testing`
- Property-based tests use `fast-check`

Run a single file:

```bash
node --test --loader ts-node/esm test/runtime.test.ts
```

## Architectural Decision Records

Any change above ~100 lines or that affects the public API requires an ADR
under `docs/adr/`. Use the next available number, copy the template from
ADR-0000, and link it from the PR description.

## Commit style

Imperative mood, ≤72 chars on the summary line. A blank line, then a
detailed body when the change isn't obvious. Reference the relevant
roadmap section (`§3 capabilities`) and ADR number where applicable.

```
add OSC 8 hyperlink support

* detect via TERM/COLORTERM and termios query
* renderer emits OSC 8 for <Link> when supported
* underline + footnote fallback otherwise

Closes #42 — refs ROADMAP §3, ADR-0004.
```

## Pull requests

- One logical change per PR. Refactors and feature work do not share a PR.
- CI must be green. PRs that fail CI will not be reviewed.
- Add a changelog entry under `## [Unreleased]` in `CHANGELOG.md`.
- Note any breaking changes explicitly with a migration snippet.

## Reporting bugs

Use the bug issue template. Include:

- graceglyph version, Node version, OS, terminal emulator
- minimal reproduction (a single `.tsx` file is best)
- expected vs actual output (paste a frame snapshot from
  `app.snapshot()` if applicable)

## Security

Do not file public issues for security problems. See
[`SECURITY.md`](./SECURITY.md).
