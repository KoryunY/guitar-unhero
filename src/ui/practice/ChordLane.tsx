import type { ChordEvent, Score } from '../../domain/score';
import { PPQ } from '../../domain/score';
import { ChordBox, StrumPattern } from '../art';

/**
 * Current and next chord with the strum pattern (gu-score/2 chord track).
 * Chords are shown and played by the app; they are never checked.
 */
export function ChordLane({ score, tick, leftHanded, playing }: { score: Score; tick: number; leftHanded: boolean; playing: boolean }) {
  const chords = score.chords ?? [];
  if (!chords.length) return null;
  const idx = chords.findIndex((c) => tick >= c.startTick - 1 && tick < c.startTick + c.durationTicks);
  const cur: ChordEvent | null = idx >= 0 ? chords[idx]! : null;
  const next = chords.find((c) => c.startTick > tick + 1) ?? null;
  const pattern = cur?.pattern ?? next?.pattern ?? null;
  const slot = playing && cur?.pattern ? Math.floor((((tick % (4 * PPQ)) + 4 * PPQ) % (4 * PPQ)) / (PPQ / 2)) % cur.pattern.length : -1;
  const capo = score.instrument.capo;
  return (
    <div className="card tight stack" style={{ gap: 10 }} data-testid="chord-lane">
      <div className="row nowrap" style={{ alignItems: 'flex-end', gap: 16 }}>
        <div className="stack" style={{ gap: 2, alignItems: 'center' }}>
          <span className="t-caption" style={{ fontWeight: 800 }}>{cur ? 'NOW' : 'FIRST'}</span>
          {(cur ?? next) && <ChordBox name={(cur ?? next)!.name} frets={(cur ?? next)!.frets} fingers={(cur ?? next)!.fingers} leftHanded={leftHanded} size={128} />}
        </div>
        {cur && next && (
          <div className="stack" style={{ gap: 2, alignItems: 'center', opacity: 0.7 }}>
            <span className="t-caption" style={{ fontWeight: 800 }}>NEXT</span>
            <ChordBox name={next.name} frets={next.frets} fingers={next.fingers} leftHanded={leftHanded} size={92} />
          </div>
        )}
        <div className="spacer stack" style={{ gap: 6 }}>
          {capo > 0 && <span className="badge" style={{ alignSelf: 'flex-start' }}>Capo on fret {capo}</span>}
          <span className="t-small muted">{pattern ? 'Strum pattern (repeats every bar)' : 'One strum per chord — let it ring'}</span>
        </div>
      </div>
      {pattern && <StrumPattern pattern={pattern} active={slot} />}
      <p className="t-caption" style={{ margin: 0 }}>Chords are shown and played along — the app does not check them.</p>
    </div>
  );
}
