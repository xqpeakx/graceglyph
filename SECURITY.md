# Security policy

## Supported versions

| Version | Status                                |
|---------|---------------------------------------|
| 0.x     | Active development; security fixes on the latest minor only |

After v1.0, the latest two minors will receive security fixes.

## Reporting a vulnerability

Email the maintainers privately at **security@graceglyph.dev** (or open a
[GitHub security advisory](https://github.com/<owner>/graceglyph/security/advisories/new)).

Please include:

- a description of the issue and its impact
- a reproduction (the smallest case that demonstrates it)
- affected versions
- any known mitigations

Do not open public issues for security problems.

## Triage SLA

- Acknowledgement within 72 hours of report.
- Initial assessment within 7 days.
- Coordinated disclosure: a fix and advisory aim to ship within 30 days
  of the initial report. Complex issues may take longer; we will keep you
  informed.

## Scope

In scope:

- The published `graceglyph`, `graceglyph/testing`, `graceglyph/jsx-runtime`,
  and `graceglyph/jsx-dev-runtime` entry points.
- The `create-graceglyph` CLI.

Likely in scope:

- ANSI escape parsing of untrusted input streams.
- Rendering attacker-controlled strings into terminal output.
- File-system reads from `usePersistentState` and templates.

Out of scope:

- Bugs in third-party plugins outside this repository.
- Physical access to a developer's machine.
- Issues exploitable only by a malicious terminal emulator the user is
  already running.

## Hardening commitments

- No `eval`, no `new Function`, no string-template execution in the
  runtime path.
- Input parser fuzzed via property-based tests.
- ANSI sequences from untrusted streams are sanitized before rendering
  text content.
- CodeQL scans run in CI on every PR.
