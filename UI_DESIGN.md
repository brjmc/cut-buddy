# Cut Buddy UI Direction

## Current Direction (February 7, 2026)
The product UI is organized around two user intents:
- Capture cuts quickly with minimal friction.
- Plan material usage with clear stock and waste outcomes.

The interface should prioritize legibility in field conditions, fast transition between capture and planning, and immediate actionability of optimization output.

## Experience Model
1. Record experience
- Full-screen, low-clutter capture surface.
- Unit context visible at top.
- Prominent latest accepted cut confirmation as the dominant center element.
- Compact grouped summary of repeated cuts beneath the latest value.
- Single primary stop action (`Stop recording`) and deterministic return to planning.

2. Plan experience
- Compact config card at the top for:
  - unit selection,
  - stock lengths,
  - kerf,
  - primary `Record` entry point.
- Results area intentionally positioned lower in the page flow (scroll-down model).
- `Calculate plan` action anchored near results for direct review after compute.
- On exit from recording, app returns to plan and auto-scrolls to results region.

## Design Principles
- Field-first readability: high contrast, large tap targets, concise copy.
- Spoken fidelity: preserve spoken text while exposing parsed values.
- Capture-first hierarchy: emphasize latest accepted measurement during recording.
- Decision-first results: surface top metrics before detailed pattern breakdown.
- Progressive flow: configure -> record -> review results, with automatic context return.

## Interaction Rules
- Recording controls should be obvious and deterministic.
- Recording-to-plan transition should preserve user context and navigate to likely next action (results review).
- Keep primary actions singular per surface:
  - record surface: stop recording.
  - config surface: start recording.
  - results surface: calculate/review.
- Secondary controls (confidence tuning, advanced edit actions) should not compete with primary flow.

## Documentation Alignment
- Source of truth for requirements: `SPEC.md`.
- Execution and backlog tracking: `plan.md`.
- This file describes UI intent and interaction architecture only.
