# Real guitar recordings (consented, local)

Put pairs saved from **Diagnostics → Guided check** here:

- `gu-<string>-<fret>-<time>.wav`
- `gu-<string>-<fret>-<time>.labels.json`

Then run `pnpm test:recordings` (report) or `GU_EVAL_STRICT=1 pnpm test:recordings` (enforce AC-08: ≥95 % of steady frames within ±15 cents).

Only add recordings you made yourself and are happy to keep in this repository. They contain only your guitar notes, but anything the microphone picked up (speech, room sound) will be in the file too — listen before committing.
