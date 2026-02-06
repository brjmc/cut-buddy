# Voice-Driven 1D Bin Packing Web App Spec

## Problem Statement
Build a web app that solves the 1D bin packing (cut list optimization) problem using voice input. Users speak cut lengths from fabrication plans, and the app calculates the most efficient way to purchase stock material.

## Core Functionality
1. **Cut List Input (Voice-to-Text)**
   - Continuous voice recognition that captures spoken measurements.
   - Expected input format: numbers followed by unit (e.g., "36 inches", "8 feet", "24").
   - Parse various phrasings: "thirty-six inches", "three foot six", "2 feet 4 inches".
   - Build a list of required cuts as the user speaks.
2. **Optimization Engine**
   - Algorithm: 1D bin packing / cutting stock problem.
   - Input: List of required cut lengths.
   - Input: Available stock lengths (e.g., 8 foot, 12 foot, 16 foot).
   - Output: Minimum number of stock pieces needed plus cutting pattern for each piece.
   - Must run entirely client-side (no server calls).
   - Should work on iOS Safari and other mobile browsers.
3. **Visual Confidence Feedback**
   - Full-screen color indicator during voice input.
   - Light blue/green: high confidence in voice recognition.
   - Orange: medium confidence; system uncertain about interpretation.
   - Red: low confidence; likely misheard.
   - Confidence threshold based on speech recognition API confidence scores.
   - Color changes in real-time as the user speaks.
4. **Audio Confirmation Feedback**
   - After each recognized cut, speak back what was heard.
   - Use text-to-speech to say: "[number] [unit]" (e.g., "36 inches").
   - Pause briefly for the user to confirm or correct before accepting the next input.
   - Provides accuracy check despite being a slower workflow.

## Technical Requirements

### Voice Recognition
- Use Web Speech API (`SpeechRecognition`).
- Continuous recognition mode.
- Handle both imperial (inches, feet) and metric (cm, mm, meters) units.
- Parse compound measurements (e.g., "3 feet 6 inches" → 42 inches).

### Optimization Algorithm
- Implement First Fit Decreasing (FFD) or Best Fit Decreasing (BFD) heuristic.
- These are fast, simple, and give near-optimal results.
- Alternative: implement column generation or use a lightweight ILP solver like GLPK compiled to WASM for optimal solutions.

### UI Components
- Voice Input Screen (full-screen color feedback).
- Cut List Review (show all captured cuts, allow manual edits).
- Stock Configuration (specify available stock lengths).
- Results Display (show cutting patterns, waste calculation, shopping list).

### Platform
- Single-page web app (HTML/CSS/JS).
- Must work on mobile browsers (iOS Safari, Chrome).
- No backend required; all processing client-side.
- Progressive Web App (PWA) characteristics for offline use.

### User Flow
1. User taps "Start Recording"; screen turns light blue.
2. User speaks a measurement (e.g., "36 inches").
3. System shows orange/red if uncertain, stays blue if confident.
4. System speaks back the measurement (e.g., "36 inches").
5. User continues with additional measurements.
6. Repeat until complete and the user taps "Done" or says "finished".
7. User reviews the list, manually edits entries if needed.
8. User sets available stock lengths (e.g., 8 ft, 12 ft).
9. User taps "Calculate".
10. App shows optimal cutting patterns and total materials needed.

### Edge Cases to Handle
- Misheard numbers (fifteen vs fifty).
- Missing units (assume inches as default?).
- Fractional measurements ("3 and a half feet", "36.5 inches").
- Duplicate cuts (user says same measurement multiple times).
- Corrections (user says "no, I meant..." requiring undo/edit).
- Background noise causing false recognitions.

### Success Criteria
- Accurately capture 95%+ of spoken measurements with confirmation loop.
- Solve bin packing problem for typical cut lists (10–50 cuts) in under 2 seconds.
- Work reliably on iOS devices.
- Minimize material waste in optimization (within 5% of optimal).

### Optional Enhancements
- Save/load cut lists.
- Multiple material types (different stock lengths for different materials).
- Account for blade kerf (material lost per cut).
- Export cutting diagrams as PDF.
- Voice commands for "undo", "clear list", "calculate".

> Sonnet 4.5Claude is AI and can make mistakes. Please double-check responses.