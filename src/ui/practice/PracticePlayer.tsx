import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import type { NoteEvent, Score } from '../../domain/score';
import { midiName, pitchClassName } from '../../domain/tuning';
import { SUPPORTED_RATES, type PracticeMode } from '../../transport/transport';
import type { TimeMap } from '../../transport/timemap';
import { useApp } from '../AppContext';
import { ListenControl } from '../components/ListenControl';
import { FretDiagram } from '../components/FretDiagram';
import { PracticeController, type CueLevel, type SimProfile } from './controller';
import { adaptationOffer } from '../../learning/adaptation';
import { Highway } from './Highway';
import { SummaryCard } from './SummaryCard';
import type { PracticeSummaryRecord } from '../../storage/types';
import { Icon } from '../icons';
import { Callout, Segmented, Sheet, ToggleRow } from '../kit';

const MODE_OPTS: { value: PracticeMode; label: string }[] = [
  { value: 'wait', label: 'Wait for me' },
  { value: 'fixed', label: 'Keep the beat' },
  { value: 'listen', label: 'Just listen' },
];
const CUE_OPTS: { value: CueLevel; label: string }[] = [
  { value: 'full', label: 'All hints' },
  { value: 'reduced', label: 'Strings only' },
  { value: 'none', label: 'From memory' },
];

/** Keep the screen awake while playing (where supported). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    let lock: { release(): Promise<void> } | null = null;
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    return () => {
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

export function PracticePlayer({
  score,
  onSummary,
  compact = false,
  initial,
  map,
  backing,
  assessmentAllowed = true,
}: {
  score: Score;
  onSummary?: (r: PracticeSummaryRecord) => void;
  /** Embedded in a lesson: inline transport, fewer options. */
  compact?: boolean;
  /** Lesson-provided defaults; otherwise the learner's saved preferences. */
  initial?: { mode?: PracticeMode; rate?: number; cueLevel?: CueLevel };
  /** Recording alignment (song workspace). */
  map?: TimeMap;
  backing?: AudioBuffer | null;
  /** False for unreviewed transcription candidates: nothing is assessed. */
  assessmentAllowed?: boolean;
}) {
  const { settings, updateSettings, addSummary, deltaIO, mic, summaries } = useApp();
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [simProfile, setSimProfile] = useState<SimProfile>('accurate');
  const [cueLevel, setCueLevel] = useState<CueLevel>(initial?.cueLevel ?? 'full');
  const [backingOn, setBackingOn] = useState(true);
  const [retention, setRetention] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [showText, setShowText] = useState(false);
  const savedIds = useRef(new Set<string>());

  const live = settings.inputMode === 'simulation' ? 'simulation' : settings.inputMode === 'microphone' && mic === 'on' ? 'microphone' : 'none';
  const inputSource = assessmentAllowed ? live : 'none';
  const opts = { inputSource, outputRoute: settings.outputRoute, guideOn: settings.guideOn, metronomeOn: settings.metronomeOn, deltaIO, simProfile, cueLevel, backingOn, assessmentAllowed } as const;

  const controller = useMemo(
    () => new PracticeController(score, engine, { ...opts }, { mode: initial?.mode ?? settings.practiceMode, rate: initial?.rate ?? settings.practiceRate }, { map, backing }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [score, map, backing],
  );

  useEffect(() => {
    const off = controller.subscribe(force);
    controller.start();
    // Redraw position-dependent text (up next) a few times a second.
    const id = window.setInterval(force, 250);
    return () => {
      off();
      window.clearInterval(id);
      controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    controller.setOptions({ ...opts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, inputSource, settings.outputRoute, settings.guideOn, settings.metronomeOn, deltaIO, simProfile, cueLevel, backingOn, assessmentAllowed]);

  // Persist each finished phrase once.
  const result = controller.result;
  useEffect(() => {
    if (result && !savedIds.current.has(result.record.id)) {
      savedIds.current.add(result.record.id);
      if (result.record.mode !== 'listen' && assessmentAllowed) {
        const r = addSummary(result.record);
        setRetention(
          r === 'retained'
            ? 'You played it from memory on a later day — it’s now marked as remembered.'
            : r === 'come-back-later'
              ? 'Well played with fewer hints. Come back on another day and play it from memory to make it stick.'
              : null,
        );
      }
      onSummary?.(result.record);
    }
  }, [result, addSummary, onSummary, assessmentAllowed]);

  const t = controller.transport;
  const running = t.running;
  useWakeLock(running);
  const offer = controller.result
    ? adaptationOffer(summaries, { arrangementId: score.arrangementId, rate: t.rate, mode: t.mode, cueLevel, loop: t.loop !== null })
    : null;

  // Keyboard: Space play/pause, Escape pause, arrows seek a beat, Home restart, N continue/skip (wait).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (optionsOpen) return;
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
  }, [controller, t, optionsOpen]);

  const reducedMotion = document.documentElement.dataset.motion === 'reduce';
  const bars = Math.max(1, Math.round(score.durationTicks / 3840));
  const pos = t.positionAt(engine.audibleNow());
  const upNext: NoteEvent | null =
    t.state === 'waitingForTarget' ? t.waitingTarget : t.events.find((e) => t.eventSec(e) >= pos - 0.02 && !controller.judgmentByNote.has(`${t.loopIteration}:${e.id}`)) ?? null;
  const lastJ = controller.judgments[controller.judgments.length - 1];
  const fbIcon = !controller.feedback ? null : lastJ?.state === 'correct' ? 'check' : lastJ?.state === 'incorrect' ? 'cross' : lastJ?.state === 'uncertain' ? 'question' : 'info';
  const backingState = controller.backingState;

  const stateText: Record<string, string> = {
    ready: 'Ready', idle: 'Ready', countIn: 'Count-in…', playing: 'Playing', paused: 'Paused', waitingForTarget: 'Waiting for your note',
    completed: 'Finished', deviceLost: 'Paused — input lost', error: 'Error',
  };
  const sourceText = !assessmentAllowed
    ? 'Not checked until you review this version'
    : t.mode === 'listen'
      ? 'Just listening — not checked'
      : inputSource === 'simulation'
        ? 'Simulated — not real'
        : inputSource === 'microphone'
          ? 'Checking your notes'
          : 'Mic off — not checked';
  const timingText = t.mode === 'wait' ? 'Rhythm not checked while waiting' : t.mode === 'listen' ? '' : deltaIO === null ? 'Timing: rough guide' : 'Timing: calibrated';
  const loopBar = t.loop && t.loop.aTick % 3840 === 0 && t.loop.bTick - t.loop.aTick === 3840 ? t.loop.aTick / 3840 : null;

  const transport = (
    <div className={compact ? 'row' : 'transport'} role="group" aria-label="Transport controls" style={compact ? { justifyContent: 'center', gap: 12 } : undefined}>
      <button type="button" className="iconbtn" onClick={() => void controller.restart()} aria-label="From the start" title="From the start" aria-keyshortcuts="Home">
        <Icon name="restart" />
      </button>
      <button type="button" className="iconbtn" onClick={() => controller.seekBeats(-1)} aria-label="Back 1 beat" title="Back 1 beat" aria-keyshortcuts="ArrowLeft">
        <Icon name="prev" />
      </button>
      <button type="button" className="play" onClick={() => controller.togglePlay()} data-testid="play-pause" aria-label={running ? 'Pause' : t.state === 'completed' ? 'Play again' : 'Play'} aria-keyshortcuts="Space">
        <Icon name={running ? 'pause' : 'play'} size={32} />
      </button>
      <button type="button" className="iconbtn" onClick={() => controller.seekBeats(1)} aria-label="Forward 1 beat" title="Forward 1 beat" aria-keyshortcuts="ArrowRight">
        <Icon name="next" />
      </button>
      <button type="button" className="iconbtn" onClick={() => setOptionsOpen(true)} aria-label="Practice options" title="Practice options" data-testid="options">
        <Icon name="options" />
      </button>
    </div>
  );

  return (
    <div className="player" data-testid="practice-player">
      {settings.inputMode !== 'simulation' && t.mode !== 'listen' && assessmentAllowed && <ListenControl purpose="check each note you play" />}
      <p className="t-caption row" style={{ gap: 6, margin: 0 }}>
        <span className={inputSource === 'simulation' ? 'badge sim' : inputSource === 'microphone' && t.mode !== 'listen' ? 'badge good' : 'badge'} data-testid="assessment-source">{sourceText}</span>
        {timingText && <span data-testid="timing-status">{timingText}</span>}
        <span>· {Math.round(t.bpm * t.rate)} BPM ({Math.round(t.rate * 100)}%)</span>
        {t.loop && <span>· repeating {loopBar !== null ? `bar ${loopBar + 1}` : 'a section'}</span>}
      </p>
      {controller.guide.notice && (
        <div className="callout warn" data-testid="guide-notice" style={{ padding: '6px 12px', alignItems: 'center' }}>
          <Icon name="headphones" size={18} />
          <div className="spacer t-small">Guide tune muted so the mic hears only you.</div>
          <button type="button" className="btn text" style={{ minHeight: 40, padding: '0 4px' }} onClick={() => updateSettings({ outputRoute: 'headphones' })}>I have headphones</button>
        </div>
      )}
      {backingState.notice && <Callout kind="warn" testId="backing-notice">{backingState.notice}</Callout>}
      {backing && t.rate !== 1 && backingOn && <Callout kind="info">The backing track only plays at 100 % speed (no time-stretching yet).</Callout>}

      <div className="upnext" aria-live="off" data-testid="upnext">
        {upNext ? (
          cueLevel === 'none' ? (
            <>
              <div className="fret" aria-hidden="true">?</div>
              <div><div className="label">Up next</div><div className="where">From memory</div></div>
            </>
          ) : (
            <>
              <div className="fret" aria-hidden="true">{cueLevel === 'reduced' ? '·' : upNext.fret === 0 ? 'O' : upNext.fret}</div>
              <div>
                <div className="label">{t.state === 'waitingForTarget' ? 'Play now' : 'Up next'}</div>
                <div className="where">
                  String {upNext.string}
                  {cueLevel === 'full' ? (upNext.fret === 0 ? ' · open' : ` · fret ${upNext.fret}${upNext.finger ? ` · finger ${upNext.finger}` : ''}`) : ''}
                </div>
                {cueLevel === 'full' && <div className="t-small muted">{pitchClassName(upNext.pitchMidi)} ({midiName(upNext.pitchMidi)})</div>}
              </div>
            </>
          )
        ) : (
          <div className="where">{t.state === 'completed' ? 'Finished — see how it went below.' : 'Press play to start.'}</div>
        )}
        <div className="spacer" />
        <span className="t-small muted" role="status" aria-live="polite" data-testid="transport-state">{stateText[t.state] ?? t.state}</span>
      </div>

      <Highway controller={controller} leftHanded={settings.handedness === 'left'} reducedMotion={reducedMotion} lookaheadSec={settings.lookaheadSec} cueLevel={cueLevel} />

      <div className="feedback-line" role="status" aria-live="polite" data-testid="feedback">
        {fbIcon && <Icon name={fbIcon} size={24} className={lastJ ? `state-${lastJ.state}` : ''} />}
        <div>
          {controller.feedback}
          {controller.loopFeedback && <div className="t-small muted">{controller.loopFeedback}</div>}
        </div>
      </div>

      {transport}

      {t.state === 'waitingForTarget' && (
        <div className="row">
          <button type="button" className="btn tonal" onClick={() => controller.skipTarget()} aria-keyshortcuts="N" data-testid="skip">
            {inputSource === 'none' ? 'I played it — continue' : 'Skip this note'}
          </button>
        </div>
      )}
      {inputSource === 'simulation' && t.mode === 'wait' && t.state === 'waitingForTarget' && (
        <div className="sim-tray">
          <button type="button" className="btn sim" onClick={() => controller.simulatePluck(true)} data-testid="sim-correct">Pretend: right note</button>
          <button type="button" className="btn sim" onClick={() => controller.simulatePluck(false)}>Pretend: wrong note</button>
        </div>
      )}
      {(running || t.state === 'paused') && controller.judgments.length > 0 && (
        <button type="button" className="btn text" onClick={() => { controller.pause(); controller.summarize(); }}>Stop and see results</button>
      )}

      {controller.result && <SummaryCard record={controller.result.record} />}
      {retention && <Callout kind="good" testId="retention">{retention}</Callout>}
      {controller.result && offer && (
        <div className="card tight stack" data-testid="offer">
          <p style={{ margin: 0 }}>{offer.text}</p>
          {offer.kind === 'faster' || offer.kind === 'slower' ? (
            <button type="button" className="btn tonal" onClick={() => { controller.setRate(offer.rate); updateSettings({ practiceRate: offer.rate }); }}>Use {Math.round(offer.rate * 100)}% speed</button>
          ) : offer.kind === 'smaller-loop' ? (
            <button type="button" className="btn tonal" onClick={() => controller.setLoop({ aTick: 0, bTick: Math.min(score.durationTicks, 3840) })}>Repeat bar 1</button>
          ) : offer.kind === 'fewer-cues' ? (
            <button type="button" className="btn tonal" onClick={() => setCueLevel('reduced')}>Hide fret numbers</button>
          ) : offer.kind === 'try-fixed' ? (
            <button type="button" className="btn tonal" onClick={() => { controller.setMode('fixed'); updateSettings({ practiceMode: 'fixed' }); }}>Switch to “Keep the beat”</button>
          ) : offer.kind === 'setup' ? (
            <a className="btn tonal" href="#/settings/mic">Check the microphone</a>
          ) : null}
        </div>
      )}

      {!compact && upNext && cueLevel === 'full' && (
        <details className="card tight">
          <summary className="t-small">Where to put your finger</summary>
          <FretDiagram
            diagram={{ highlight: [upNext.string], dot: upNext.fret > 0 ? { string: upNext.string, fret: upNext.fret, finger: upNext.finger } : undefined, caption: `String ${upNext.string}${upNext.fret === 0 ? ', open' : `, fret ${upNext.fret}`}.` }}
            leftHanded={settings.handedness === 'left'}
          />
        </details>
      )}

      {showText && cueLevel !== 'none' && <NotesTable controller={controller} />}

      {optionsOpen && (
        <Sheet title="Practice options" onClose={() => setOptionsOpen(false)} testId="options-sheet">
          <div className="stack">
            <div className="field"><span>How to play</span>
              <Segmented label="Mode" value={t.mode} options={MODE_OPTS} onChange={(m) => { controller.setMode(m); updateSettings({ practiceMode: m }); }} testId="mode" />
              <span className="t-caption">{t.mode === 'wait' ? 'Stops at each note until it hears it. Rhythm isn’t checked.' : t.mode === 'fixed' ? 'The music keeps going; notes and timing are checked.' : 'Hear it played; nothing is checked.'}</span>
            </div>
            <div className="field"><span>Speed</span>
              <Segmented label="Speed" value={t.rate} options={SUPPORTED_RATES.map((r) => ({ value: r as number, label: `${Math.round(r * 100)}%` }))} onChange={(r) => { controller.setRate(r); updateSettings({ practiceRate: r as 0.5 | 0.75 | 1 }); }} testId="speed" />
            </div>
            <div className="field"><span>How much help?</span>
              <Segmented label="Hints" value={cueLevel} options={CUE_OPTS} onChange={setCueLevel} testId="cues" />
              <span className="t-caption">Fewer hints help you play away from the screen. Playing from memory on a later day marks a piece as remembered.</span>
            </div>
            <div className="field"><span>Repeat a bar</span>
              <div className="row">
                <button type="button" className={`chip${t.loop ? '' : ' on'}`} onClick={() => controller.setLoop(null)}>Whole piece</button>
                {Array.from({ length: bars }, (_, i) => (
                  <button key={i} type="button" className={`chip${loopBar === i ? ' on' : ''}`} onClick={() => controller.setLoop({ aTick: i * 3840, bTick: Math.min(score.durationTicks, (i + 1) * 3840) })}>Bar {i + 1}</button>
                ))}
              </div>
            </div>
            <div className="list">
              <ToggleRow title="Guide tune" sub="Plays the notes for you to follow (headphones recommended)" checked={settings.guideOn} onChange={(v) => updateSettings({ guideOn: v })} />
              <ToggleRow title="Metronome clicks" checked={settings.metronomeOn} onChange={(v) => updateSettings({ metronomeOn: v })} />
              {backing && <ToggleRow title="Backing track" sub="Your imported recording (100 % speed only)" checked={backingOn} onChange={setBackingOn} />}
              <ToggleRow title="Show notes as text" sub="A list of every note (tab)" checked={showText} onChange={setShowText} testId="show-text" />
            </div>
            {settings.advanced && (
              <>
                <div className="section-title">Advanced</div>
                <div className="field"><span>Look-ahead</span>
                  <Segmented label="Look-ahead" value={settings.lookaheadSec} options={[2, 3, 4].map((s) => ({ value: s, label: `${s} s` }))} onChange={(s) => updateSettings({ lookaheadSec: s })} />
                </div>
                {inputSource === 'simulation' && (
                  <div className="field"><span>Simulated player</span>
                    <Segmented label="Simulated player" value={simProfile} options={[{ value: 'accurate', label: 'Accurate' }, { value: 'mixed', label: 'Some mistakes' }, { value: 'silent', label: 'Silent' }]} onChange={setSimProfile} />
                  </div>
                )}
                <p className="t-caption">Score: {score.arrangementId} v{score.version} · {score.role.replace('_', ' ')} · rights {score.rights.status.replace('_', ' ')} · {score.provenance.reviewStatus.replace('_', ' ')}. {score.provenance.notes}</p>
              </>
            )}
            <p className="t-caption">Keys: Space play/pause · Esc pause · ←/→ one beat · Home from the start · N continue in wait mode.</p>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function NotesTable({ controller }: { controller: PracticeController }) {
  const t = controller.transport;
  const nextIdx = t.events.findIndex((e) => !controller.judgmentByNote.has(`${t.loopIteration}:${e.id}`) && t.eventSec(e) >= t.positionSec - 0.01);
  return (
    <div className="card tight" style={{ overflowX: 'auto' }}>
      <table className="events" aria-label="Notes in this exercise">
        <thead><tr><th>#</th><th>Bar.beat</th><th>String</th><th>Fret</th><th>Finger</th><th>Note</th><th>Result</th></tr></thead>
        <tbody>
          {t.events.map((e, i) => {
            const j = controller.judgmentByNote.get(`${t.loopIteration}:${e.id}`);
            const beat = e.startTick / 960;
            return (
              <tr key={e.id} className={i === nextIdx ? 'next' : ''}>
                <td>{i + 1}</td>
                <td>{Math.floor(beat / 4) + 1}.{Math.floor(beat % 4) + 1}</td>
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
    </div>
  );
}
