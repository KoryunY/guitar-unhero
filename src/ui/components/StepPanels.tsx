import { useEffect, useRef, useState } from 'react';
import { engine, type Handle } from '../../audio/engine';
import { attemptFeedback, chordDiagram, type ChordShape, type LessonStep } from '../../learning/lessons';
import { higherLowerRounds } from '../../learning/ear';
import { pulseFeedback, scoreTaps } from '../../learning/pulse';
import { midiName, pitchClassName } from '../../domain/tuning';
import type { Evidence } from '../../storage/types';
import { useApp } from '../AppContext';
import { FretDiagram } from './FretDiagram';
import { ChordBox, StrumPattern } from '../art';
import { InputMeter } from './InputMeter';
import { ListenControl } from './ListenControl';

/** Multiple-choice check. Wrong answers just explain; retry freely. */
export function QuizPanel({ quiz, onComplete }: { quiz: NonNullable<LessonStep['quiz']>; onComplete: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === quiz.answer;
  return (
    <fieldset style={{ marginTop: 12 }}>
      <legend>{quiz.question}</legend>
      {quiz.options.map((o, i) => (
        <label key={o} style={{ display: 'block', margin: '4px 0' }}>
          <input
            type="radio"
            name="quiz"
            checked={picked === i}
            onChange={() => {
              setPicked(i);
              if (i === quiz.answer) onComplete();
            }}
          />{' '}
          {o}
        </label>
      ))}
      {picked !== null && (
        <p role="status" className={`callout ${correct ? 'good' : 'warn'}`} data-testid="quiz-feedback">
          {correct ? 'Yes! ' : 'Not quite — try another answer. '}
          {correct ? quiz.explain : ''}
        </p>
      )}
    </fieldset>
  );
}

/** Tap along with metronome clicks (keyboard/touch). Personal timing indication only. */
export function TapPulsePanel({ bpm, beats, onComplete }: { bpm: number; beats: number; onComplete: () => void }) {
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [beat, setBeat] = useState<number | null>(null);
  const taps = useRef<number[]>([]);
  const clicks = useRef<number[]>([]);
  const handles = useRef<Handle[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => {
    handles.current.forEach((h) => h.stop());
    timers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (state !== 'running') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        taps.current.push(e.timeStamp);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  const start = async () => {
    const ctx = await engine.ensureContext();
    taps.current = [];
    clicks.current = [];
    const beatSec = 60 / bpm;
    const t0 = ctx.currentTime + 0.3;
    const total = 4 + beats;
    handles.current = [];
    for (let i = 0; i < total; i++) {
      const c = t0 + i * beatSec;
      const h = engine.playClick(c, i % 4 === 0);
      if (h) handles.current.push(h);
      if (i >= 4) clicks.current.push(c);
    }
    setState('running');
    setMsg('Count-in: listen to four clicks, then tap on every click.');
    timers.current = Array.from({ length: total }, (_, i) =>
      window.setTimeout(() => setBeat(i < 4 ? -(4 - i) : i - 3), (0.3 + i * beatSec) * 1000),
    );
    timers.current.push(
      window.setTimeout(() => {
        // Expected heard time of each click on the performance clock.
        const heard = clicks.current.map((c) => engine.contextToPerformanceMs(c) ?? 0);
        const r = scoreTaps(heard, taps.current);
        const fb = pulseFeedback(r, beats);
        setMsg(fb.text);
        setState('done');
        setBeat(null);
        if (fb.pass) onComplete();
      }, (0.3 + total * beatSec + 0.6) * 1000),
    );
  };

  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="btn primary" onClick={start} disabled={state === 'running'} data-testid="pulse-start">{state === 'done' ? 'Try again' : 'Start'}</button>
        <button
          type="button"
          className="btn primary"
          onPointerDown={(e) => { if (state === 'running') taps.current.push(e.timeStamp); }}
          disabled={state !== 'running'}
          style={{ minWidth: 180, minHeight: 88, fontSize: '1.4rem', borderRadius: 44 }}
          aria-label="Tap on the beat"
          data-testid="pulse-tap"
        >
          Tap
        </button>
        <span aria-live="polite" style={{ fontSize: '1.6rem', fontWeight: 700, minWidth: 80 }}>
          {beat === null ? '' : beat < 0 ? `count ${4 + beat + 1}` : `beat ${((beat - 1) % 4) + 1}`}
        </span>
      </div>
      <p role="status" aria-live="polite" className="feedback-line" data-testid="pulse-feedback">{msg ?? `${bpm} BPM, ${beats} beats after a 4-click count-in.`}</p>
    </div>
  );
}

/**
 * Pluck a sequence of single notes in order (chord string-by-string checks,
 * echo phrases). Each note is a separate isolated-pitch check; chord
 * completeness is never claimed.
 */
export function SequencePanel({ step, onComplete, evidenceSource }: { step: LessonStep; onComplete: (e: Evidence) => void; evidenceSource: Evidence }) {
  const { settings, mic } = useApp();
  const seq = step.sequence!;
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(!seq.playFirst);
  const [playing, setPlaying] = useState(false);
  const done = idx >= seq.targets.length;
  const sim = settings.inputMode === 'simulation';
  const listening = sim || mic === 'on';
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const demo = useRef<Handle | null>(null);
  useEffect(() => () => demo.current?.stop(), []);

  useEffect(() => {
    if (!listening) return;
    return engine.on('attack', (a) => {
      if (a.simulated !== sim) return;
      const i = idxRef.current;
      const spec = seq.targets[i];
      if (!spec) return;
      if (a.quality !== 'good' || a.pitchMidiFloat === null) {
        setMsg(a.reasonCodes.includes('clipping') ? 'Too loud for the microphone (clipping). Pluck softer or move back.' : 'I heard a sound but not one clear note. Pluck just that one string; if it sounded dull or buzzy, move your fingertip closer to the fret.');
        return;
      }
      const fb = attemptFeedback(spec, a.pitchMidiFloat);
      const prefix = sim ? 'Simulated: ' : '';
      if (!fb.correct) {
        setMsg(`${prefix}${fb.text}`);
        return;
      }
      idxRef.current = i + 1;
      setIdx(i + 1);
      if (i + 1 >= seq.targets.length) {
        setMsg(`${prefix}${fb.text} All ${seq.targets.length} notes heard in order.`);
        completeRef.current(evidenceSource);
      } else setMsg(`${prefix}${fb.text} Next one.`);
    });
  }, [listening, sim, seq, evidenceSource]);

  const playPhrase = async () => {
    demo.current?.stop();
    const d = await engine.demonstrate(seq.targets.map((t) => t.targetMidi), 0.9, 'reference');
    demo.current = d.handle;
    setPlaying(true);
    window.setTimeout(() => setPlaying(false), (d.end - d.start) * 1000);
  };

  const cur = seq.targets[Math.min(idx, seq.targets.length - 1)]!;
  return (
    <div className="stack">
      {!sim && <ListenControl purpose="hear each note you pluck" />}
      {mic === 'on' && <InputMeter compact />}
      {seq.playFirst && (
        <div className="row" style={{ margin: '8px 0' }}>
          <button type="button" className="btn tonal" onClick={playPhrase} disabled={playing}>{playing ? 'Playing… (listening paused)' : '▶ Play the phrase'}</button>
          {!revealed && <button type="button" className="btn tonal" onClick={() => setRevealed(true)}>Show answer</button>}
        </div>
      )}
      <ol className="t-body" aria-label="Notes to play in order" style={{ margin: 0, paddingLeft: 24 }}>
        {seq.targets.map((t, i) => (
          <li key={i} className={i < idx ? 'state-correct' : ''} style={{ fontWeight: i === idx ? 700 : 400 }}>
            {i < idx ? '✓ ' : ''}
            {revealed || i < idx ? `${seq.label} string ${t.string}${t.fret === 0 ? ' open' : `, fret ${t.fret}`} — ${midiName(t.targetMidi)}` : `Note ${i + 1}: ?`}
          </li>
        ))}
      </ol>
      <p role="status" aria-live="polite" className="feedback-line" data-testid="sequence-feedback">
        {msg ?? (done ? 'Done.' : listening ? `Listening for ${revealed ? pitchClassName(cur.targetMidi) : `note ${idx + 1}`}…` : 'Listening is off — use the self-check when you have played it.')}
      </p>
      <div className="row">
        {sim && !done && (
          <div className="sim-tray">
            <button type="button" className="btn sim" onClick={() => engine.simulateAttack(cur.targetMidi)} data-testid="sim-correct">Pretend: right note</button>
            <button type="button" className="btn sim" onClick={() => engine.simulateAttack(cur.targetMidi + 2)}>Pretend: wrong note</button>
          </div>
        )}
        {idx > 0 && !done && <button type="button" className="btn tonal" onClick={() => { idxRef.current = 0; setIdx(0); setMsg(null); }}>Start again</button>}
        {step.selfCheckLabel && <button type="button" className="btn tonal" onClick={() => onComplete('self_reported')}>{step.selfCheckLabel}</button>}
      </div>
    </div>
  );
}

/** Strum along with chord names per bar. Strums are not assessed. */
export function StrumAlongPanel({ strum, leftHanded }: { strum: NonNullable<LessonStep['strum']>; leftHanded: boolean }) {
  const [pos, setPos] = useState<{ bar: number; beat: number } | null>(null);
  const handles = useRef<Handle[]>([]);
  const raf = useRef(0);
  const shapeFor = (name: string): ChordShape | undefined => strum.shapes.find((s) => s.name.includes(`(${name})`) || s.name === name);

  const stop = () => {
    handles.current.forEach((h) => h.stop());
    handles.current = [];
    cancelAnimationFrame(raf.current);
    setPos(null);
  };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    stop();
    const ctx = await engine.ensureContext();
    const beatSec = 60 / strum.bpm;
    const t0 = ctx.currentTime + 0.3;
    const total = 4 + strum.bars.length * 4;
    for (let i = 0; i < total; i++) {
      const h = engine.playClick(t0 + i * beatSec, i % 4 === 0);
      if (h) handles.current.push(h);
    }
    const tick = () => {
      const k = Math.floor((engine.now - t0) / beatSec);
      if (k >= total) {
        setPos(null);
        return;
      }
      setPos(k < 4 ? { bar: -1, beat: k + 1 } : { bar: Math.floor((k - 4) / 4), beat: ((k - 4) % 4) + 1 });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const cur = pos && pos.bar >= 0 ? strum.bars[pos.bar]! : strum.bars[0]!;
  const next = pos && pos.bar >= 0 ? strum.bars[pos.bar + 1] : strum.bars[0];
  const changing = pos !== null && pos.bar >= 0 && next !== undefined && next !== cur && pos.beat === 4;
  const shape = shapeFor(pos?.bar === -1 ? strum.bars[0]! : cur);
  return (
    <div className="stack">
      <p className="callout warn">Not assessed: strummed chords and chord changes are practice with your own ears. Nothing here is scored.</p>
      <div className="row">
        <button type="button" className="btn primary" onClick={start} data-testid="strum-start">{pos ? 'Restart' : 'Start'}</button>
        {pos && <button type="button" className="btn tonal" onClick={stop}>Stop</button>}
        <span className="t-small muted">{strum.bpm} BPM · {strum.pattern ? 'follow the arrows' : 'strum on beat 1'}</span>
      </div>
      <div aria-live="polite" style={{ fontSize: '2rem', fontWeight: 800, margin: '10px 0' }} data-testid="strum-now">
        {pos === null ? `${strum.bars.join(' · ')}` : pos.bar < 0 ? `Count-in ${pos.beat}` : `${cur} — beat ${pos.beat}${pos.beat === 1 ? ' STRUM' : ''}`}
      </div>
      {changing && <p className="callout" role="status">Prepare: change to {next} now.</p>}
      {strum.pattern && <StrumPattern pattern={strum.pattern} active={pos && pos.bar >= 0 ? (pos.beat - 1) * 2 : -1} />}
      {shape && (
        <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
          <ChordBox name={shape.name} frets={[...shape.lowToHigh].reverse().map((f) => (f === 'x' ? null : f))} fingers={[...shape.fingersLowToHigh].reverse()} leftHanded={leftHanded} size={140} />
          <div className="spacer" style={{ minWidth: 240 }}><FretDiagram diagram={chordDiagram(shape)} leftHanded={leftHanded} /></div>
        </div>
      )}
    </div>
  );
}

/** Which of two notes is higher? No guitar needed. */
export function EarComparePanel({ ear, onComplete }: { ear: NonNullable<LessonStep['ear']>; onComplete: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const rounds = higherLowerRounds(ear.pool, ear.rounds, ear.seed + attempt);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const h = useRef<Handle | null>(null);
  useEffect(() => () => h.current?.stop(), []);
  const round = rounds[i];

  const play = async () => {
    if (!round) return;
    h.current?.stop();
    h.current = (await engine.demonstrate([round.first, round.second], 0.9, 'reference')).handle;
  };
  const answer = (a: 'first' | 'second') => {
    if (!round || answered) return;
    const ok = a === round.answer;
    const ns = score + (ok ? 1 : 0);
    setScore(ns);
    setAnswered(true);
    setMsg(`${ok ? 'Right' : 'Not this time'}: the ${round.answer} note (${midiName(round.answer === 'first' ? round.first : round.second)}) was higher.`);
    if (i === rounds.length - 1 && ns >= Math.ceil(rounds.length * 0.66)) onComplete();
  };
  const nextRound = () => {
    setI(i + 1);
    setAnswered(false);
    setMsg(null);
  };
  const finished = i >= rounds.length - 1 && answered;
  return (
    <div className="stack">
      <p className="t-small">Round {Math.min(i + 1, rounds.length)} of {rounds.length} · score {score}</p>
      <div className="row">
        <button type="button" className="btn primary" onClick={play} data-testid="ear-play">▶ Play two notes</button>
        <button type="button" className="btn tonal" onClick={() => answer('first')} disabled={answered} data-testid="ear-first">First was higher</button>
        <button type="button" className="btn tonal" onClick={() => answer('second')} disabled={answered} data-testid="ear-second">Second was higher</button>
        {answered && !finished && <button type="button" className="btn tonal" onClick={nextRound}>Next round</button>}
        {finished && <button type="button" className="btn tonal" onClick={() => { setAttempt(attempt + 1); setI(0); setScore(0); setAnswered(false); setMsg(null); }}>Play again</button>}
      </div>
      <p role="status" aria-live="polite" className="feedback-line" data-testid="ear-feedback">
        {msg}
        {finished && ` Final score ${score} of ${rounds.length}.${score >= Math.ceil(rounds.length * 0.66) ? ' Step complete.' : ' Try another set — your ears improve with practice.'}`}
      </p>
    </div>
  );
}
