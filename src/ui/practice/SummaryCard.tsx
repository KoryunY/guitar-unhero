import type { PracticeSummaryRecord } from '../../storage/types';
import { Icon } from '../icons';

function pct(x: number | null): string {
  return x === null ? 'not assessed' : `${Math.round(x * 100)}%`;
}

/**
 * "How it went": leads with the one next step; right notes and timing are shown
 * separately, with how many notes could be heard clearly (coverage). A zero
 * denominator reads "not assessed", never 0 %.
 */
export function SummaryCard({ record }: { record: PracticeSummaryRecord }) {
  const s = record.stats;
  return (
    <section className="card stack" aria-label="How it went" data-testid="summary" style={record.simulated ? { borderColor: 'var(--sim)', background: 'var(--sim-soft)' } : undefined}>
      <div className="row nowrap">
        <h3 className="t-card spacer">How it went</h3>
        {record.simulated && <span className="badge sim">Simulated — not real assessment</span>}
      </div>
      <p className="result-hero" data-testid="suggestion" style={{ margin: 0 }}>
        <Icon name="sparkle" size={20} /> {record.suggestion}
      </p>
      <div className="tally">
        <div>
          <div className="big">{s.pitch.assessed ? `${s.pitch.correct}/${s.pitch.assessed}` : '–'}</div>
          <div className="lbl">Right notes</div>
          <div className="t-caption" data-testid="pitch-accuracy">{pct(s.pitch.accuracy)}</div>
        </div>
        <div>
          <div className="big">{s.timing.enabled ? (s.timing.assessed ? `${s.timing.correct}/${s.timing.assessed}` : '–') : '–'}</div>
          <div className="lbl">On the beat</div>
          <div className="t-caption">{!s.timing.enabled ? 'not checked' : s.timing.assessed ? `${pct(s.timing.accuracy)}${s.timing.approximate ? ' · rough guide' : ''}` : 'not assessed'}</div>
        </div>
        <div>
          <div className="big">{`${s.assessable}/${s.eligible}`}</div>
          <div className="lbl">Heard clearly</div>
          <div className="t-caption" data-testid="coverage">{pct(s.coverage)}</div>
        </div>
      </div>
      <details>
        <summary className="t-small">Details</summary>
        <p className="t-small" style={{ marginTop: 8 }}>
          ✓ {s.states.correct} right · ✗ {s.states.incorrect} not right · ? {s.states.uncertain} unclear · – {s.states.not_assessed} not checked. {s.missed ? `${s.missed} not heard. ` : ''}
          {record.mode === 'wait' ? 'Wait-for-me mode' : record.mode === 'fixed' ? 'Keep-the-beat mode' : 'Listen mode'} at {Math.round(record.rate * 100)}% speed{record.loop ? ', repeating a section' : ''}
          {record.cueLevel && record.cueLevel !== 'full' ? `, ${record.cueLevel === 'none' ? 'from memory' : 'strings only'}` : ''}.
          {s.pitch.assessed > 0 && ` ${s.pitch.correct} of ${s.pitch.assessed} heard notes were the right note; ${s.assessable} of ${s.eligible} notes could be heard clearly.`}
        </p>
      </details>
    </section>
  );
}
