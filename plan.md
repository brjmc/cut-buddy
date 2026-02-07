# Cut Buddy Plan

## Current State (February 7, 2026)
Implemented and active in the app:
- Voice capture with continuous speech recognition.
- Confidence feedback with live color/state updates.
- Spoken measurement parsing with mixed-fraction formatting in UI.
- Cut list management (add, remove, duplicate, inline update).
- Unit-aware display and parsing defaults (inches, feet, cm, mm).
- Stock configuration + kerf input.
- Client-side Best Fit Decreasing optimization.
- Results with stock count, waste, utilization, kerf impact, and per-stock cut patterns.
- Local persistence and PWA shell support.
- Record flow now enters from explicit `Record cuts` action and exits on `Stop recording`.
- Record view now runs as an immersive full-screen capture surface with app chrome hidden.
- Header mode toggle controls removed from user-visible UI.
- Manual entry widget removed (to be reintroduced later with a redesigned correction UX).
- Metric unit selection now applies metric-aware default stock presets.

## Open Workstreams
1. Input Reliability and Parsing
- Harden fraction parsing for denominator-word phrases and unsupported formats.
- Improve error messaging for parse failures to avoid silent/bogus numeric outputs.

2. Planning and Presets
- Continue refining stock setup ergonomics for fast editing.
- Confirm preset behavior with existing saved/local states across unit switches.

3. Quality and Validation
- Add parser/optimizer regression tests for core measurement cases.
- Run cross-device validation (iOS Safari priority).

## Immediate Next Implementation Batch
1. Harden parser handling for denominator-word and unsupported fraction phrases (safe-fail behavior).
2. Add parser/optimizer regression tests for high-risk measurement inputs.
3. Validate full recording/plan workflow on iOS Safari and mobile Chrome.
4. Design and implement a replacement manual correction interaction pattern.

## Future Change List
- None.
