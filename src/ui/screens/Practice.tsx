import { useMemo } from 'react';
import { findBundledScore } from '../../content/scores';
import { practiceRightsIssue, validateScore } from '../../domain/validate';
import { navigate, StatusChip, SoundToggle } from '../App';
import { PracticePlayer } from '../practice/PracticePlayer';
import { Callout, TopBar } from '../kit';

/** Full-screen player for a bundled piece. */
export function PracticeScreen({ arrangementId }: { arrangementId: string }) {
  const raw = findBundledScore(arrangementId);
  // Bundled content is validated at load like any other score (no special trust).
  const validation = useMemo(() => (raw ? validateScore(JSON.parse(JSON.stringify(raw))) : null), [raw]);
  const rightsIssue = validation?.ok ? practiceRightsIssue(validation.score) : null;
  return (
    <section aria-label="Practice">
      <TopBar title={raw?.title.replace(/ — .*$/, '') ?? 'Practice'} back={() => navigate('practice')}>
        <StatusChip />
        <SoundToggle />
      </TopBar>
      {!raw && <Callout kind="bad">This piece was not found.</Callout>}
      {validation && !validation.ok && (
        <Callout kind="bad">
          <strong>This score could not be loaded:</strong>
          <ul>{validation.issues.map((i, k) => <li key={k}><code>{i.path}</code> {i.message}</li>)}</ul>
        </Callout>
      )}
      {rightsIssue && <Callout kind="bad">{rightsIssue}</Callout>}
      {validation?.ok && !rightsIssue && <PracticePlayer key={validation.score.arrangementId} score={validation.score} />}
    </section>
  );
}
