import { useMemo } from 'react';
import { BUNDLED_SCORES, findBundledScore } from '../../content/scores';
import { practiceRightsIssue, validateScore } from '../../domain/validate';
import { navigate } from '../App';
import { PracticePlayer } from '../practice/PracticePlayer';

export function PracticeScreen({ arrangementId }: { arrangementId: string | null }) {
  const id = arrangementId ?? 'exercise.first-two-strings';
  const raw = findBundledScore(id);
  // Bundled content is validated at load like any other score (no special trust).
  // Memoized so re-renders never recreate the practice controller mid-attempt.
  const validation = useMemo(() => (raw ? validateScore(JSON.parse(JSON.stringify(raw))) : null), [raw]);
  const rightsIssue = validation?.ok ? practiceRightsIssue(validation.score) : null;
  return (
    <section aria-labelledby="practice-h">
      <h1 id="practice-h">Practice</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <label>
          Exercise{' '}
          <select value={id} onChange={(e) => navigate('practice', e.target.value)} aria-label="Exercise">
            {BUNDLED_SCORES.map((s) => <option key={s.arrangementId} value={s.arrangementId}>{s.title}</option>)}
          </select>
        </label>
      </div>
      {!raw && <p className="callout bad">Unknown exercise.</p>}
      {validation && !validation.ok && (
        <div className="callout bad" role="alert">
          <strong>This score could not be loaded:</strong>
          <ul>{validation.issues.map((i, k) => <li key={k}><code>{i.path}</code> {i.message}</li>)}</ul>
        </div>
      )}
      {rightsIssue && <p className="callout bad">{rightsIssue}</p>}
      {validation?.ok && !rightsIssue && (
        <div className="panel">
          <PracticePlayer key={validation.score.arrangementId} score={validation.score} />
          <p className="small muted" style={{ marginBottom: 0 }}>
            Original exercise · rights: {validation.score.rights.status.replace('_', ' ')} · {validation.score.provenance.reviewStatus.replace('_', ' ')}. {validation.score.provenance.notes}
          </p>
        </div>
      )}
    </section>
  );
}
