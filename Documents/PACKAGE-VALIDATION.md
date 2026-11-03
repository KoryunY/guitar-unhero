# Package validation

Validated November 3, 2026.

- The score contract is valid JSON Schema Draft 2020-12.
- The original example passes schema validation, including date-time format checking, and the package's semantic checks.
- 14 negative cases were rejected: pitch/fret inconsistency, duplicate IDs, score bounds, overlap, ordering, open-string fingering, unsupported capo/chord/tempo variants, unknown properties, negative duration, malformed date, excessive fret, and non-monotonic alignment.
- The example has eight quarter notes, two 4/4 bars, and eight seconds of musical duration at 60 BPM, before count-in.
- The master specification has 15 main sections and 24 first-release acceptance criteria. Its current length is approximately 12,882 words.
- The six budget allocations sum to $249. Referenced package filenames exist, and Markdown code fences are balanced.

This validates the specification package and example data. No Guitar Unhero application, microphone accuracy, camera accuracy, teaching outcome, or public-release readiness has been implemented or certified by these checks. The acceptance criteria are instructions for the later build and evaluation.
