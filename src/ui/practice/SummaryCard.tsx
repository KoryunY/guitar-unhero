import type { PracticeSummaryRecord } from '../../storage/types';

function pct(x: number | null): string {
  return x === null ? 'not assessed' : `${Math.round(x * 100)}%`;
}

/** Session review: coverage beside accuracy, pitch and timing separately, one next action. */
export function SummaryCard({ record }: { record: PracticeSummaryRecord }) {
  const s = record.stats;
  return (
    <section className={`panel ${record.simulated ? 'callout sim' : ''}`} aria-label="Phrase summary" data-testid="summary">
      <h3 style={{ marginTop: 0 }}>
        Phrase review{record.simulated ? ' — SIMULATED (not a real assessment)' : ''}
      </h3>
      <div className="stats">
        <div className="stat">
          <div className="small muted">Pitch</div>
          <div className="big" data-testid="pitch-accuracy">{pct(s.pitch.accuracy)}</div>
          <div className="small">{s.pitch.assessed ? `${s.pitch.correct} of ${s.pitch.assessed} assessed notes` : 'No notes could be assessed'}</div>
        </div>
        <div className="stat">
          <div className="small muted">Timing</div>
          <div className="big">{s.timing.enabled ? pct(s.timing.accuracy) : 'not graded'}</div>
          <div className="small">
            {!s.timing.enabled ? 'Wait mode does not grade rhythm.' : s.timing.assessed ? `${s.timing.correct} of ${s.timing.assessed} on time${s.timing.approximate ? ' (approximate — uncalibrated)' : ''}` : 'No timing assessed'}
          </div>
        </div>
        <div className="stat">
          <div className="small muted">Coverage</div>
          <div className="big" data-testid="coverage">{pct(s.coverage)}</div>
          <div className="small">{s.assessable} of {s.eligible} notes could be assessed</div>
        </div>
        <div className="stat">
          <div className="small muted">Results</div>
          <div className="small">
            ✓ {s.states.correct} correct · ✗ {s.states.incorrect} incorrect · ? {s.states.uncertain} uncertain · – {s.states.not_assessed} not assessed
          </div>
          <div className="small muted">{record.mode === 'wait' ? 'Wait mode' : 'Fixed tempo'} at {Math.round(record.rate * 100)}%{record.loop ? ', looped' : ''}</div>
        </div>
      </div>
      <p className="callout" style={{ marginBottom: 0 }} data-testid="suggestion"><strong>Next:</strong> {record.suggestion}</p>
    </section>
  );
}
