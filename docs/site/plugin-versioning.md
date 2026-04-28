# Plugin Versioning Policy

This policy defines compatibility expectations for packages built on the
graceglyph plugin API.

## Package ranges

- Plugin packages should declare `graceglyph` as a peer dependency.
- Recommended initial range: `>=0.0.1 <0.3.0` while the core runtime migration
  remains in progress.
- Tighten ranges if your plugin uses newly added plugin-surface APIs.

## Compatibility contract

- Patch updates (`x.y.Z`) must not break plugin registration or activation.
- Minor updates (`x.Y.z`) may evolve internals during pre-1.0, but must keep
  documented plugin APIs stable unless release notes state otherwise.
- Breaking plugin API shifts require explicit migration notes in changelog/docs.

## Deprecation cycle

- Mark deprecated plugin APIs in one minor release before removal.
- Emit runtime warnings where practical to aid migration.
- Keep one full minor release overlap between "deprecated" and "removed."

## Author guidance

1. Pin CI against latest graceglyph minor and previous supported minor.
2. Include plugin activation tests (`registry.register` + `registry.activate`).
3. Prefer additive evolution over replacing existing plugin contracts.
