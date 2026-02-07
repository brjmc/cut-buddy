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
1. [x] Harden parser handling for denominator-word and unsupported fraction phrases (safe-fail behavior).
2. [x] Add parser/optimizer regression tests for high-risk measurement inputs.
3. [x] Validate full recording/plan workflow on iOS Safari and mobile Chrome. (manual validation complete; see `MOBILE_VALIDATION_REPORT.md`)
4. [x] Design and implement a replacement manual correction interaction pattern.

## UI Sketch Implementation Plan (February 7, 2026)
Target: align app flow to attached sketch with:
- A compact config/plan card at top.
- A dedicated recording view while capturing.
- Results section positioned below the fold in plan mode.
- Automatic scroll to results area when returning from record to plan.

### Existing UI Analysis
- Current app has two separate mode containers:
  - `#recordView` (full-screen, hides hero and plan with `body.record-mode-active`).
  - `#planView` (single-page plan controls + input + stock + results grid).
- Plan controls are currently split across multiple cards and include confidence tools not shown in sketch.
- Record view currently prioritizes confidence label/score and grouped summary, while sketch prioritizes:
  - unit at top,
  - most recent accepted cut large in center,
  - grouped repeated cuts beneath,
  - single stop-recording action.
- Returning from record mode currently just toggles view; no targeted scroll behavior exists.

### Implementation Plan
1. [x] Restructure Plan DOM to match sketch hierarchy
- Introduce a top “Config/Plan” card containing:
  - title,
  - unit selector,
  - stock lengths input + pill preview,
  - kerf input,
  - primary `Record` CTA.
- Move optimization output into a lower “Results” section that naturally sits below fold on mobile.
- Keep `Calculate plan` anchored near results section per sketch.

2. [x] Simplify controls for sketch parity
- Remove/de-emphasize confidence slider/pills from plan surface (keep internals if needed, hide from primary UX).
- Preserve existing edit/undo/clear operations, but move secondary actions out of primary visual path.
- Rename CTA labels to sketch language:
  - `Record cuts` -> `record`
  - `Stop recording` stays primary in record mode.

3. [x] Adjust recording view content and visual priority
- Keep immersive recording screen behavior.
- Reorder record content blocks:
  - unit label top,
  - latest accepted measurement dominant center text,
  - grouped counts beneath latest value,
  - bottom sticky `stop recording` button.
- Ensure parse failures show explicit “could not parse” feedback without replacing stable grouped summary.

4. [x] Implement “return + auto-scroll to results” flow
- Add a stable anchor id for results section (example: `#resultsSection`).
- On transition `record -> plan`:
  - complete mode switch,
  - `requestAnimationFrame`/micro-delay,
  - call `scrollIntoView({ behavior: "smooth", block: "start" })` on results section.
- Gate auto-scroll to only run on exits from recording (not all mode changes).

5. [x] Responsive behavior and spacing
- Mobile-first stack should mirror sketch:
  - config card first,
  - results section below.
- Desktop keeps readable widths but preserves vertical workflow order.
- Verify button sizing and spacing for field use tap targets.

6. [x] Accessibility and interaction checks
- Keep clear ARIA labels for recording region and result area.
- Ensure focus moves predictably after mode switch:
  - on enter record: focus stop/start button,
  - on exit record: focus results heading (after scroll) for screen-reader continuity.
- Respect reduced-motion preference for smooth scroll fallback.

7. [x] Validation checklist (manual validation complete)
- Start in plan mode, tap `record`, confirm immersive record view.
- Accept several spoken cuts, verify central latest value + grouped list updates.
- Tap `stop recording`, verify:
  - plan mode restored,
  - viewport scrolls to results area,
  - existing cuts preserved.
- Run `calculate plan`, confirm results render and remain reachable via normal scroll.

## Future Change List
- After sketch parity, add a compact “jump to config” affordance when user is deep in results.
