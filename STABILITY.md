# Stability Plan

The bar for graceglyph is not "works on the happy path."

The bar is:

> Build full-featured terminal apps in TypeScript as easily as building a modern web UI.

That means the framework needs standout stability, clean composition, strong typing,
and zero framework-level weirdness under normal use.

## 1. Unicode and Text Semantics

- [x] Grapheme-safe cursor movement and editing
- [x] Grapheme-safe clipping and truncation helpers
- [x] Wide-glyph buffer clipping behavior covered by tests
- [x] Generated UAX #11 width table
- [x] Broader emoji / CJK / combining-mark integration coverage

## 2. Runtime Integration Coverage

- [x] Fake-terminal startup / shutdown tests
- [x] Resize lifecycle tests
- [x] Focus-cycle integration tests
- [x] Mouse click / keyboard interaction tests
- [x] Cursor placement integration tests
- [x] Devtools toggle integration tests

## 3. Reconciler and Effect Lifecycle

- [x] Scheduler ownership isolated per fiber tree
- [x] Keyed reordering tests
- [x] Mount / unmount / remount lifecycle tests
- [x] Effect cleanup ordering tests
- [x] State updates during effects tests

## 4. Layout and Rendering Guarantees

- [x] Core flex layout math tests
- [x] ScreenBuffer diff and wide-cell tests
- [x] Renderer diff tests against a fake terminal
- [x] Border/title clipping tests
- [x] Deep nesting / padding / gap stress tests

## 5. Error Reporting and DX

- [x] Fatal runtime boundary wraps crashes by phase
- [x] Better component-stack error context
- [x] Invalid-prop diagnostics
- [x] Layout/debug diagnostics beyond the current inspector
- [x] Dev-focused docs for debugging terminal issues

## 6. Onboarding and Product Validation

- [x] Stronger flagship example in `example:hello`
- [ ] Automated onboarding smoke tests
- [ ] "Useful in 10 minutes" validation flow
- [ ] Example suite quality pass
- [ ] Docs pass for first-run success and customization
