import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import type { Score, StringNumber } from '../../domain/score';
import { BAR_TICKS, History, deleteNote, placeNote, updateNote } from '../../domain/edit';
import { midiName, openMidi, STRING_LABELS } from '../../domain/tuning';
import { Icon } from '../icons';
import { Segmented } from '../kit';

const STEP = 480; // eighth-note grid
const CELL = 36;
const DURS = [
  { value: 480, label: '♪ 1/8' },
  { value: 960, label: '♩ 1/4' },
  { value: 1920, label: '𝅗𝅥 1/2' },
  { value: 3840, label: '𝅝 whole' },
];

/**
 * Tab-style grid editor for monophonic parts: rows = strings (1 on top),
 * columns = eighth notes. Tap an empty cell to place a note with the chosen
 * fret and length; tap a note to select it, then change fret/length/position,
 * delete, or listen. Undo/redo; nothing is saved until "Save version".
 */
export function ScoreEditor({ score, onChange, uncertainTicks = [], onSave, saving }: { score: Score; onChange: (s: Score) => void; uncertainTicks?: number[]; onSave: (s: Score) => void; saving?: boolean }) {
  const history = useRef(new History<Score>(score));
  const [, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [fret, setFret] = useState(0);
  const [dur, setDur] = useState(960);
  const [error, setError] = useState<string | null>(null);
  const cur = history.current.present;

  useEffect(() => {
    if (score !== history.current.present) {
      history.current = new History(score);
      setTick((x) => x + 1);
    }
  }, [score]);

  const apply = (next: Score) => {
    history.current.push(next);
    setTick((x) => x + 1);
    onChange(next);
    setError(null);
  };
  const audition = async (midi: number) => {
    const ctx = await engine.ensureContext();
    engine.playNote(midi, ctx.currentTime + 0.02, 'reference', 0.8);
  };
  const steps = Math.max(8, Math.ceil(cur.durationTicks / STEP));
  const sel = cur.events.find((e) => e.id === selected) ?? null;
  const uncertain = useMemo(() => new Set(uncertainTicks.map((t) => Math.round(t / STEP))), [uncertainTicks]);

  const place = (string: StringNumber, step: number) => {
    try {
      const r = placeNote(cur, { startTick: step * STEP, durationTicks: dur, string, fret });
      apply(r.score);
      setSelected(r.id);
      void audition(openMidi(string) + fret);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const edit = (patch: Parameters<typeof updateNote>[2]) => {
    if (!sel) return;
    try {
      const next = updateNote(cur, sel.id, patch);
      apply(next);
      const e = next.events.find((x) => x.id === sel.id);
      if (e && (patch.fret !== undefined || patch.string !== undefined)) void audition(e.pitchMidi);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onChange(e.shiftKey ? history.current.redo() : history.current.undo());
        setTick((x) => x + 1);
        return;
      }
      if (!sel) return;
      if (/^[0-9]$/.test(e.key)) edit({ fret: Number(e.key) });
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        apply(deleteNote(cur, sel.id));
        setSelected(null);
      } else if (e.key === 'ArrowLeft' && sel.startTick >= STEP) edit({ startTick: sel.startTick - STEP });
      else if (e.key === 'ArrowRight') edit({ startTick: sel.startTick + STEP });
      else if (e.key === 'ArrowUp' && sel.string > 1) edit({ string: (sel.string - 1) as StringNumber });
      else if (e.key === 'ArrowDown' && sel.string < 6) edit({ string: (sel.string + 1) as StringNumber });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="stack" data-testid="score-editor">
      <div className="row">
        <button type="button" className="iconbtn" aria-label="Undo" disabled={!history.current.canUndo} onClick={() => { onChange(history.current.undo()); setTick((x) => x + 1); }}><Icon name="undo" /></button>
        <button type="button" className="iconbtn" aria-label="Redo" disabled={!history.current.canRedo} onClick={() => { onChange(history.current.redo()); setTick((x) => x + 1); }}><Icon name="redo" /></button>
        <span className="t-small muted spacer">{cur.events.length} notes · {Math.ceil(cur.durationTicks / BAR_TICKS)} bars</span>
        <button type="button" className="btn tonal" onClick={() => apply({ ...cur, durationTicks: cur.durationTicks + BAR_TICKS })}><Icon name="plus" size={18} /> Bar</button>
      </div>
      <div className="field"><span>New note: fret</span>
        <div className="row" role="group" aria-label="Fret for new notes">
          {Array.from({ length: 13 }, (_, f) => (
            <button key={f} type="button" className={`chip${fret === f ? ' on' : ''}`} onClick={() => setFret(f)} aria-pressed={fret === f}>{f === 0 ? 'open' : f}</button>
          ))}
        </div>
      </div>
      <div className="field"><span>New note: length</span>
        <Segmented label="Length for new notes" value={dur} options={DURS} onChange={setDur} />
      </div>
      <div className="editor-grid" role="grid" aria-label="Notes grid: strings by eighth notes">
        <table>
          <tbody>
            {([1, 2, 3, 4, 5, 6] as StringNumber[]).map((s) => (
              <tr key={s}>
                <th scope="row">{s} {STRING_LABELS[s].name.replace(/\d/, '')}</th>
                {Array.from({ length: steps }, (_, i) => {
                  const ev = cur.events.find((e) => e.string === s && Math.round(e.startTick / STEP) === i);
                  return (
                    <td key={i} className={i % 8 === 0 ? 'bar' : i % 2 === 0 ? 'beat' : ''}>
                      <button type="button" className="cell" aria-label={`String ${s}, bar ${Math.floor(i / 8) + 1} beat ${Math.floor((i % 8) / 2) + 1}${i % 2 ? ' and' : ''}: place fret ${fret}`} onClick={() => place(s, i)} />
                      {ev && (
                        <button
                          type="button"
                          className={`note-block${ev.id === selected ? ' selected' : ''}${uncertain.has(i) ? ' uncertain' : ''}`}
                          style={{ width: Math.max(CELL - 2, (ev.durationTicks / STEP) * CELL - 4) }}
                          onClick={() => { setSelected(ev.id); void audition(ev.pitchMidi); }}
                          aria-label={`Note ${midiName(ev.pitchMidi)}, string ${s} fret ${ev.fret}${uncertain.has(i) ? ', uncertain' : ''}`}
                          aria-pressed={ev.id === selected}
                        >
                          {ev.fret}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel ? (
        <div className="card tight stack" aria-label="Selected note">
          <div className="row">
            <strong className="spacer">{midiName(sel.pitchMidi)} — string {sel.string}, {sel.fret === 0 ? 'open' : `fret ${sel.fret}`}</strong>
            <button type="button" className="iconbtn" aria-label="Listen" onClick={() => void audition(sel.pitchMidi)}><Icon name="volume" /></button>
          </div>
          <div className="row">
            <button type="button" className="btn outline" onClick={() => edit({ fret: Math.max(0, sel.fret - 1) })} aria-label="Fret down">Fret −</button>
            <button type="button" className="btn outline" onClick={() => edit({ fret: Math.min(cur.instrument.maxFret, sel.fret + 1) })} aria-label="Fret up">Fret +</button>
            <button type="button" className="btn outline" disabled={sel.startTick < STEP} onClick={() => edit({ startTick: sel.startTick - STEP })} aria-label="Move earlier"><Icon name="prev" size={18} /> Earlier</button>
            <button type="button" className="btn outline" onClick={() => edit({ startTick: sel.startTick + STEP })} aria-label="Move later">Later <Icon name="next" size={18} /></button>
          </div>
          <Segmented label="Length" value={sel.durationTicks} options={DURS.some((d) => d.value === sel.durationTicks) ? DURS : [...DURS, { value: sel.durationTicks, label: `${sel.durationTicks / 960} beats` }]} onChange={(d) => edit({ durationTicks: d })} />
          <button type="button" className="btn danger" onClick={() => { apply(deleteNote(cur, sel.id)); setSelected(null); }}><Icon name="trash" size={18} /> Delete note</button>
        </div>
      ) : (
        <p className="t-small muted">Tap an empty square to add a note. Tap a note to change it. Keys: 0–9 fret, arrows move, Delete removes, Ctrl+Z undo.</p>
      )}
      {error && <p className="callout bad" role="alert">{error}</p>}
      <button type="button" className="btn primary block" onClick={() => onSave(cur)} disabled={saving} data-testid="save-version">Save as new version</button>
    </div>
  );
}
