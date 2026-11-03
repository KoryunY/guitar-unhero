# Known limitations (after M3–M5, reviews and redesign)

## Not yet verified with hardware (open)
- No physical guitar, microphone, room, headphones, phone or camera has been tested. AC-08 (real-note accuracy), AC-11 (feedback latency on reference hardware), AC-13 (audio/cursor drift), AC-18 (real leakage) remain **pending**. The Mic test lab (Settings → Advanced tools) measures these on your device and can save guided recordings for `pnpm test:recordings`.
- Detector thresholds were tuned on *guitar-like synthetic* signals and three independent review experiments. Real strings, laptop mics and rooms may still need tuning.

## Sensing boundaries (by design)
- Pitch identifies the sounding note, not the string, fret, finger, pressure or posture.
- Chords are taught and checked one string at a time; strummed chords and chord changes are not assessed.
- With several strings ringing, the app cancels up to two earlier notes; if it is still unsure the note is "uncertain", never "wrong". Very fast notes (8ths at 120 BPM) get a pitch about half the time.
- A re-pluck of a string that is still ringing loudly may not be heard as a new note (to avoid crediting clicks/knocks as notes).

## Song workspace (M3)
- Backing recordings play only at 100 % speed (no time-stretching).
- Alignment is linear (tap along, then nudge). Recordings that speed up, slow down, repeat or cut sections are warned about but not truly synchronised; practise a shorter excerpt.
- The editor is monophonic (one note at a time) in 4/4 with eighth-note resolution; no chords, ties, techniques, tempo or meter changes (gu-score/1 limits).
- Song audio and scores are not included in the progress backup; export the notes per song (More → Save the notes as a file). The recording stays only in this browser.
- No MusicXML/MIDI/Guitar Pro import; only gu-score JSON.

## Transcription (M4, experimental)
- Works only on clean recordings of one guitar playing one note at a time. No chords, no band mixes, no source separation, no bends/slides.
- Synthetic evaluation passes the spec's note-F1 ≥ 0.85 gate (F1 1.00 on the clean synthetic melody), but there is **no real-recording evaluation**; it stays in candidate-review mode: nothing is assessed until you review the notes.
- Tempo estimation can pick half/double tempo; you choose among alternatives or tap the tempo first.

## Camera (M5, experimental)
- Off by default; a mirror plus optional on-device hand tracking. It can say "hand in view" and, after you mark the fretboard, a *rough* fret area for your index fingertip. It never grades and never claims contact, string, pressure or exact fret.
- No evaluation data; the spec's ≥ 95 % precision gate for corrective camera messages is not met, so none are shown.
- Hand tracking runs on the main thread at ~5 fps (a worker is future work); it downloads ~21 MB from this app the first time.

## Timing
- Uncalibrated timing uses the browser's output-latency estimate and wide windows ("Timing: rough guide"). Loopback calibration needs speakers; headphones use the manual adjustment. Bluetooth latency is not corrected (calibration is invalidated when the output latency changes).

## Learning content
- 14 draft lessons, not yet reviewed by a human guitar teacher (an AI teacher review was applied). Strumming patterns, C/G/D chords, muting and an accompanied piece are later work.

## Platform
- Target: current Chrome/Edge on desktop and Android; iOS Safari and Firefox untested. Installable as a web app (manifest + offline service worker); no native wrapper yet.
- Automated axe checks pass on all screens (light/dark/high-contrast/phone); a human screen-reader review has not been done. WCAG conformance is not claimed.
- UI strings are not yet extracted for translation.
