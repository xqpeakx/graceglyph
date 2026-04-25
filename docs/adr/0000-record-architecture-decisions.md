# ADR-0000: Record architecture decisions

- Status: Accepted
- Date: 2026-04-25
- Deciders: maintainers

## Context

graceglyph is heading toward v1.0 (see `ROADMAP.md`). Several decisions in
the next six months are large enough to deserve a written record so that a
later contributor can reconstruct the reasoning without spelunking commit
history.

## Decision

We use Architectural Decision Records (Michael Nygard format) for every
change above ~100 lines or any change that affects the public API,
runtime model, or rendering pipeline.

ADRs live under `docs/adr/NNNN-kebab-title.md`. Numbers are immutable. A
superseded ADR stays in place and links forward to the replacement.

## Consequences

- New contributors can read `docs/adr/` start-to-finish to understand why
  the framework is shaped the way it is.
- PRs that introduce non-trivial design changes are blocked until an ADR
  lands or is updated.
- Reversing a decision means writing a new ADR that supersedes the old
  one, not editing history.

## Template

```markdown
# ADR-NNNN: <title>

- Status: Proposed | Accepted | Superseded by ADR-XXXX
- Date: YYYY-MM-DD
- Deciders: <names>

## Context

<the forces at play>

## Decision

<what we decided to do>

## Consequences

<what becomes easier or harder>

## Alternatives considered

<options we rejected and why>
```
