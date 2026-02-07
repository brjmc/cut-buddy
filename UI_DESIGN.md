# Cut Buddy UI Direction

## Current Direction (February 7, 2026)
The product UI is organized around two user intents:
- Capture cuts quickly with minimal friction.
- Plan material usage with clear stock and waste outcomes.

The interface should prioritize legibility in field conditions, high confidence in interpreted measurements, and immediate actionability of optimization output.

## Experience Model
1. Record experience
- Full-screen, low-clutter capture surface.
- Strong visual confidence state (color + label + score).
- Prominent latest accepted cut confirmation.
- Compact grouped summary of repeated cuts.
- Single primary recording control and a path back to planning.

2. Plan experience
- Unit selection and stock setup in one place.
- Cut list review with editable entries and aggregate stats.
- Optimization summary first (stock count, waste, utilization, kerf impact), then detailed patterns.

## Design Principles
- Field-first readability: high contrast, large tap targets, concise copy.
- Spoken fidelity: preserve spoken text while also exposing parsed values.
- Decision-first results: surface top metrics before detailed pattern breakdown.
- Progressive detail: fast overview first, drill-down second.

## Interaction Rules
- Recording controls should be obvious and deterministic.
- Editing should happen inline to avoid context switching.
- Mode semantics should remain implementation detail where possible; users should think in tasks (record vs plan), not app internals.

## Documentation Alignment
- Source of truth for requirements: `SPEC.md`.
- Execution and backlog tracking: `plan.md`.
- This file describes UI intent and interaction architecture only.
