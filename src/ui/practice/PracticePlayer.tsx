import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import type { Score } from '../../domain/score';
import { midiName } from '../../domain/tuning';
import { SUPPORTED_RATES, type PracticeMode } from '../../transport/transport';
import { useApp } from '../AppContext';
import { ListenControl } from '../components/ListenControl';
import { PracticeController, type SimProfile } from './controller';
import { Highway } from './Highway';
import { SummaryCard } from './SummaryCard';
import type { PracticeSummaryRecord } from '../../storage/types';

const MODE_LABEL: Record<PracticeMode, string> = { wait: 'Wait for me', fixed: 'Fixed tempo', listen: 'Listen (demo)' };

export function PracticePlayer({ score, onSummary, compact = false }: { score: Score; onSummary?: (r: PracticeSummaryRecord) => void; compact?: boolean }) {
  const { settings, updateSettings, addSummary, deltaIO, mic } = useApp();
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [simProfile, setSimProfile] = useState<SimProfile>('accurate');
  const savedIds = useRef(new Set<string>());

  const inputSource = settings.inputMode === 'simulation' ? 'simulation' : settings.inputMode === 'microphone' && mic === 'on' ? 'microphone' : 'none';

  const controller = useMemo(
    () =>
      new PracticeController(
        score,
        engine,
        { inputSource, outputRoute: settings.outputRoute, guideOn: settings.guideOn, metronomeOn: settings.metronomeOn, deltaIO, simProfile },
        { mode: settings.practiceMode, rate: settings.practiceRate },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [score],
  );

  useEffect(() => {
    const off = controller.subscribe(force);
    controller.start();
    return () => {
      off();
      controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    controller.setOptions({ inputSource, outputRoute: settings.outputRoute, guideOn: settings.guideOn, metronomeOn: settings.metronomeOn, deltaIO, simProfile });
  }, [controller, inputSource, settings.outputRoute, settings.guideOn, settings.metronomeOn, deltaIO, simProfile]);

  // Persist each finished phrase once.
  const result = controller.result;
  useEffect(() => {
    if (result && !savedIds.current.has(result.record.id)) {
      savedIds.current.add(result.record.id);
      if (result.record.mode !== 'listen') addSummary(result.record);
      onSummary?.(result.record);
    }
  }, [result, addSummary, onSummary]);

  const t = controller.transport;

  // Keyboard: Space play/pause, Escape pause, arrows seek a beat, Home restart, N continue/skip (wait).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === ' ') {
        if (el?.tagName === 'BUTTON') return; // let the focused button act
        e.preventDefault();
        controller.togglePlay();
      } else if (e.key === 'Escape') controller.pause();
      else if (e.key === 'ArrowLeft') controller.seekBeats(-1);
      else if (e.key === 'ArrowRight') controller.seekBeats(1);
      else if (e.key === 'Home') void controller.restart();
      else if ((e.key === 'n' || e.key === 'N') && t.state === 'waitingForTarget') controller.skipTarget();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, t]);

  const reducedMotion = document.documentElement.dataset.motion === 'reduce';
  const beats = Math.round(score.durationTicks / 960);
  const posBeat = Math.min(beats - 1, Math.max(0, Math.floor(t.positionSec / t.beatSec + 1e-6)));
  const loopA = t.loop ? t.loop.aTick / 960 : 0;
  const loopB = t.loop ? t.loop.bTick / 960 : beats;
  const running = t.running;
  const guide = controller.guide;
  const nextIdx = t.events.findIndex((e) => !controller.judgmentByNote.has(`${t.loopIteration}:${e.id}`) && t.eventSec(e) >= t.positionSec - 0.01);

  const stateText: Record<string, string> = {
    ready: 'Ready', idle: 'Ready', countIn: 'Count-in…', playing: 'Playing', paused: 'Paused', waitingForTarget: 'Waiting for your note',
    completed: 'Finished', deviceLost: 'Paused — input lost', error: 'Error',
  };

  return (
    <div data-testid="practice-player">
      {!compact && <h2 style={{ marginTop: 0 }}>{score.title}</h2>}
      {settings.inputMode !== 'simulation' && t.mode !== 'listen' && <ListenControl purpose="check each note you play" />}
      <div className="row small" style={{ marginBottom: 6 }}>
        <span className={`pill ${inputSource === 'simulation' ? 'sim' : inputSource === 'microphone' ? 'on' : 'off'}`} data-testid="assessment-source">
          {t.mode === 'listen' ? 'Listen mode — not assessed' : inputSource === 'simulation' ? 'SIMULATED input — not real assessment' : inputSource === 'microphone' ? 'Assessing with microphone' : 'Listening off — not assessed'}
        </span>
        <span className="pill" data-testid="timing-status">{t.mode === 'wait' ? 'Timing not graded in wait mode' : deltaIO === null ? 'Timing approximate (uncalibrated)' : `Timing calibrated (${Math.round(deltaIO * 1000)} ms)`}</span>
        <span className="pill">{t.bpm * t.rate} BPM ({Math.round(t.rate * 100)}%)</span>
      </div>
      {guide.notice && <p className="callout warn small" data-testid="guide-notice">{guide.notice}</p>}

      <Highway controller={controller} leftHanded={settings.handedness === 'left'} reducedMotion={reducedMotion} lookaheadSec={settings.lookaheadSec} />

      <div className="transport" role="group" aria-label="Transport controls">
        <button className="primary" onClick={() => controller.togglePlay()} data-testid="play-pause" aria-keyshortcuts="Space">
          {running ? 'Pause' : t.state === 'completed' ? 'Play again' : 'Play'}
        </button>
        <button onClick={() => void controller.restart()} aria-keyshortcuts="Home">Restart</button>
        <button onClick={() => controller.seekBeats(-1)} aria-label="Back one beat" aria-keyshortcuts="ArrowLeft">◀ beat</button>
        <button onClick={() => controller.seekBeats(1)} aria-label="Forward one beat" aria-keyshortcuts="ArrowRight">beat ▶</button>
        {t.state === 'waitingForTarget' && (
          <button onClick={() => controller.skipTarget()} aria-keyshortcuts="N" data-testid="skip">
            {inputSource === 'none' ? 'Continue' : 'Skip this note'}
          </button>
        )}
        {inputSource === 'simulation' && t.mode === 'wait' && t.state === 'waitingForTarget' && (
          <>
            <button onClick={() => controller.simulatePluck(true)} data-testid="sim-correct">Simulate: right note</button>
            <button onClick={() => controller.simulatePluck(false)}>Simulate: wrong note</button>
          </>
        )}
        <span role="status" aria-live="polite" data-testid="transport-state">{stateText[t.state] ?? t.state}</span>
        {(running || t.state === 'paused') && controller.judgments.length > 0 && (
          <button onClick={() => { controller.pause(); controller.summarize(); }}>End & review</button>
        )}
      </div>

      <div className="feedback" role="status" aria-live="polite" data-testid="feedback">
        {controller.feedback}
        {controller.loopFeedback && <div className="small">{controller.loopFeedback}</div>}
      </div>

      {controller.result && <SummaryCard record={controller.result.record} />}

      <details open={!compact}>
        <summary>Practice options</summary>
        <div className="grid2" style={{ marginTop: 8 }}>
          <fieldset>
            <legend>Mode</legend>
            {(['wait', 'fixed', 'listen'] as PracticeMode[]).map((m) => (
              <label key={m} style={{ display: 'block' }}>
                <input type="radio" name={`mode-${score.arrangementId}`} checked={t.mode === m} onChange={() => { controller.setMode(m); updateSettings({ practiceMode: m }); }} /> {MODE_LABEL[m]}
              </label>
            ))}
            <p className="small muted">Wait mode stops before each note and continues when it hears it (rhythm is not graded). Fixed tempo keeps going and checks pitch and timing.</p>
          </fieldset>
          <fieldset>
            <legend>Tempo</legend>
            {SUPPORTED_RATES.map((r) => (
              <label key={r} style={{ marginRight: 12 }}>
                <input type="radio" name={`rate-${score.arrangementId}`} checked={t.rate === r} onChange={() => { controller.setRate(r); updateSettings({ practiceRate: r }); }} /> {Math.round(r * 100)}%
              </label>
            ))}
            <p className="small muted">Slower tempos reschedule the synthesized notes, so pitch stays the same.</p>
          </fieldset>
          <fieldset>
            <legend>Loop (A–B, in beats)</legend>
            <label>A <select value={loopA} onChange={(e) => { const a = Number(e.target.value); controller.setLoop({ aTick: a * 960, bTick: Math.max(a + 1, loopB) * 960 }); }} aria-label="Loop start beat">
              {Array.from({ length: beats }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
            </select></label>{' '}
            <label>B <select value={loopB} onChange={(e) => { const b = Number(e.target.value); controller.setLoop({ aTick: Math.min(loopA, b - 1) * 960, bTick: b * 960 }); }} aria-label="Loop end beat">
              {Array.from({ length: beats }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1 === beats ? 'end' : `before ${i + 2}`}</option>)}
            </select></label>{' '}
            {t.loop ? <button onClick={() => controller.setLoop(null)}>Clear loop</button> : <span className="small muted">Off</span>}
            <p className="small muted">Position: beat {posBeat + 1} of {beats}.</p>
            <input type="range" min={0} max={beats - 1} value={posBeat} onChange={(e) => controller.seekTick(Number(e.target.value) * 960)} aria-label="Seek to beat" style={{ width: '100%' }} />
          </fieldset>
          <fieldset>
            <legend>Sound</legend>
            <label style={{ display: 'block' }}><input type="checkbox" checked={settings.guideOn} onChange={(e) => updateSettings({ guideOn: e.target.checked })} /> Guide notes (synthesized)</label>
            <label style={{ display: 'block' }}><input type="checkbox" checked={settings.metronomeOn} onChange={(e) => updateSettings({ metronomeOn: e.target.checked })} /> Metronome clicks</label>
            <label style={{ display: 'block' }} className="small">Guide volume <input type="range" min={0} max={1} step={0.05} value={settings.guideLevel} onChange={(e) => updateSettings({ guideLevel: Number(e.target.value) })} /></label>
            <label style={{ display: 'block' }} className="small">Metronome volume <input type="range" min={0} max={1} step={0.05} value={settings.metronomeLevel} onChange={(e) => updateSettings({ metronomeLevel: Number(e.target.value) })} /></label>
            <label className="small">Look-ahead <select value={settings.lookaheadSec} onChange={(e) => updateSettings({ lookaheadSec: Number(e.target.value) })}>{[2, 3, 4].map((s) => <option key={s} value={s}>{s} s</option>)}</select></label>
          </fieldset>
          {inputSource === 'simulation' && (
            <fieldset>
              <legend>Simulated player</legend>
              {(['accurate', 'mixed', 'silent'] as SimProfile[]).map((p) => (
                <label key={p} style={{ display: 'block' }}><input type="radio" name={`sim-${score.arrangementId}`} checked={simProfile === p} onChange={() => setSimProfile(p)} /> {p === 'accurate' ? 'Mostly accurate' : p === 'mixed' ? 'Some wrong, late and missed notes' : 'Silent'}</label>
              ))}
              <p className="small muted">Shows how feedback works. Never saved as real progress.</p>
            </fieldset>
          )}
        </div>
      </details>

      <details>
        <summary>Notes as text (tablature list)</summary>
        <table className="events" aria-label="Notes in this exercise">
          <thead><tr><th>#</th><th>Bar.beat</th><th>String</th><th>Fret</th><th>Finger</th><th>Note</th><th>Result</th></tr></thead>
          <tbody>
            {t.events.map((e, i) => {
              const j = controller.judgmentByNote.get(`${t.loopIteration}:${e.id}`);
              const beat = e.startTick / 960;
              return (
                <tr key={e.id} className={i === nextIdx ? 'next' : ''}>
                  <td>{i + 1}</td>
                  <td>{Math.floor(beat / 4) + 1}.{(beat % 4) + 1}</td>
                  <td>{e.string}</td>
                  <td>{e.fret === 0 ? 'open' : e.fret}</td>
                  <td>{e.finger ?? '—'}</td>
                  <td>{midiName(e.pitchMidi)}</td>
                  <td className={j ? `state-${j.state}` : ''}>{j ? `${j.state.replace('_', ' ')}${j.simulated ? ' (simulated)' : ''}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="small muted">Keys: <span className="kbd">Space</span> play/pause, <span className="kbd">Esc</span> pause, <span className="kbd">←</span>/<span className="kbd">→</span> one beat, <span className="kbd">Home</span> restart, <span className="kbd">N</span> continue/skip in wait mode.</p>
      </details>
    </div>
  );
}
