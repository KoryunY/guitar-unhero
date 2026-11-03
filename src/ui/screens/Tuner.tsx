import { useEffect, useMemo, useRef, useState } from 'react';
import { engine, type Handle } from '../../audio/engine';
import { TunerTracker, type TunerReading } from '../../audio/tuner';
import { pitchClassName } from '../../domain/tuning';
import { presetOpenMidi, tuningPreset, TUNINGS } from '../../domain/tunings';
import type { TuningChoice } from '../../storage/types';
import type { StringNumber } from '../../domain/score';
import { useApp } from '../AppContext';
import { PageHead } from '../App';
import { InputMeter } from '../components/InputMeter';
import { ListenControl } from '../components/ListenControl';
import { Callout, Segmented } from '../kit';
import { Icon } from '../icons';

const ORDER: StringNumber[] = [6, 5, 4, 3, 2, 1];

/** A 3+3 headstock seen from the front. Decorative mirror of the string buttons below (which are the accessible controls). */
function Headstock({ str, tuned, names, onPick, locked }: { str: StringNumber; tuned: Set<StringNumber>; names: Record<StringNumber, string>; onPick: (s: StringNumber) => void; locked: boolean }) {
  const posts: Record<StringNumber, { x: number; y: number; side: -1 | 1 }> = {
    4: { x: 82, y: 72, side: -1 }, 5: { x: 82, y: 132, side: -1 }, 6: { x: 82, y: 192, side: -1 },
    3: { x: 158, y: 72, side: 1 }, 2: { x: 158, y: 132, side: 1 }, 1: { x: 158, y: 192, side: 1 },
  };
  const nutX = (s: StringNumber) => 96 + (6 - s) * 9.6;
  return (
    <svg className="headstock" viewBox="-20 0 280 300" aria-hidden="true">
      <defs>
        <linearGradient id="hs-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6b4329" />
          <stop offset="1" stopColor="#3b2416" />
        </linearGradient>
      </defs>
      <path d="M66 22q54-26 108 0l8 220q-4 18-20 24H78q-16-6-20-24z" fill="url(#hs-wood)" stroke="#1b1320" strokeWidth="3" />
      <path d="M92 32q28-10 56 0" stroke="#e8c48a" strokeWidth="2" fill="none" opacity="0.6" />
      <rect x="88" y="262" width="64" height="8" rx="2" fill="#f4ecd8" />
      <rect x="86" y="270" width="68" height="30" fill="#4a2e1d" />
      {ORDER.map((s) => {
        const p = posts[s];
        const on = s === str;
        const knobX = p.x + p.side * 58;
        const color = tuned.has(s) ? 'var(--correct)' : on ? (locked ? 'var(--correct)' : 'var(--primary)') : '#d9d4cc';
        return (
          <g key={s} className="peg" onClick={() => onPick(s)}>
            <line x1={p.x} y1={p.y} x2={nutX(s)} y2={300} stroke={on ? 'var(--hot-1)' : s >= 3 ? '#d6b06a' : '#e8eaed'} strokeWidth={on ? 3.2 : 1 + (s - 1) * 0.35} />
            {on && <line x1={p.x} y1={p.y} x2={nutX(s)} y2={300} stroke="var(--hot-1)" strokeWidth="10" opacity="0.25" />}
            <rect x={Math.min(p.x, knobX)} y={p.y - 4} width={Math.abs(knobX - p.x)} height="8" fill="#9aa0a6" />
            <circle cx={p.x} cy={p.y} r="7" fill="#c9ccd1" stroke="#1b1320" strokeWidth="2" />
            <circle className="knob" cx={knobX} cy={p.y} r="22" fill={color} stroke="#1b1320" strokeWidth="2.5" />
            <text x={knobX} y={p.y + 7} textAnchor="middle" fontSize="20" fontWeight="900" fill={tuned.has(s) || on ? '#fff' : '#1b1320'}>{names[s]}</text>
            {tuned.has(s) && <text x={knobX + p.side * 34} y={p.y + 7} textAnchor="middle" fontSize="20" fontWeight="900" fill="var(--correct)">✓</text>}
          </g>
        );
      })}
    </svg>
  );
}

function Gauge({ cents, locked }: { cents: number | null; locked: boolean }) {
  const c = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  const angle = (c / 50) * 70; // degrees
  const ticks = [-50, -25, -10, 0, 10, 25, 50];
  return (
    <svg className="tuner-gauge" viewBox="0 0 300 170" aria-hidden="true">
      <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="var(--surface-3)" strokeWidth="14" strokeLinecap="round" />
      <path d="M 129 32 A 120 120 0 0 1 171 32" fill="none" stroke="var(--correct)" strokeWidth="14" />
      {ticks.map((t) => {
        const a = ((t / 50) * 70 * Math.PI) / 180;
        return <line key={t} x1={150 + Math.sin(a) * 100} y1={150 - Math.cos(a) * 100} x2={150 + Math.sin(a) * 88} y2={150 - Math.cos(a) * 88} stroke="var(--muted)" strokeWidth={t === 0 ? 3 : 1.5} />;
      })}
      {cents !== null && (
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '150px 150px', transition: 'transform 90ms linear' }}>
          <line x1="150" y1="150" x2="150" y2="40" stroke={locked ? 'var(--correct)' : 'var(--primary)'} strokeWidth="6" strokeLinecap="round" />
        </g>
      )}
      <circle cx="150" cy="150" r="10" fill="var(--text)" />
      <text x="30" y="168" fontSize="13" fill="var(--muted)">Too low</text>
      <text x="270" y="168" fontSize="13" fill="var(--muted)" textAnchor="end">Too high</text>
    </svg>
  );
}

export function TunerScreen() {
  const { settings, mic, updateSettings } = useApp();
  const tuning = settings.tuning;
  const openMidi = (s: StringNumber) => presetOpenMidi(tuning, s);
  const [mode, setMode] = useState<'string' | 'chromatic'>('string');
  const [str, setStr] = useState<StringNumber>(6);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [tuned, setTuned] = useState<Set<StringNumber>>(new Set());
  const [refPlaying, setRefPlaying] = useState(false);
  const tracker = useMemo(() => new TunerTracker({ mode: 'string', targetMidi: 40, targetString: 6 }), []);
  const refHandle = useRef<Handle | null>(null);
  const lastUi = useRef(0);
  const lockedSince = useRef<number | null>(null);

  useEffect(() => {
    const target = presetOpenMidi(tuning, str);
    // String names in messages ("string 6 (low E)") describe standard tuning only.
    tracker.setOptions(mode === 'string' ? { mode, targetMidi: target, ...(tuning === 'standard' ? { targetString: str } : {}) } : { mode });
    setReading(null);
    lockedSince.current = null;
  }, [mode, str, tracker, tuning]);
  useEffect(() => setTuned(new Set()), [tuning]);

  useEffect(() => {
    return engine.on('frame', (f) => {
      // While the reference tone plays, the tuner must not lock onto the app's own sound.
      if (f.reasonCodes.includes('app_sound_playing')) {
        tracker.reset();
        setReading({ status: 'silent', message: 'Reference tone playing — tuner paused.', hz: null, midiFloat: null, noteName: null, cents: null, targetMidi: null, direction: null, reasonCodes: ['app_sound_playing'] });
        return;
      }
      const r = tracker.push(f);
      const n = performance.now();
      if (n - lastUi.current > 50 || r.status === 'inTune') {
        lastUi.current = n;
        setReading(r);
      }
    });
  }, [tracker]);

  // Auto-advance to the next string after ~1.5 s in tune.
  useEffect(() => {
    if (mode !== 'string') return;
    if (reading?.status !== 'inTune') {
      lockedSince.current = null;
      return;
    }
    lockedSince.current ??= performance.now();
    if (performance.now() - lockedSince.current > 1500) {
      setTuned((t) => new Set(t).add(str));
      const idx = ORDER.indexOf(str);
      if (idx < ORDER.length - 1) setStr(ORDER[idx + 1]!);
      lockedSince.current = null;
    }
  }, [reading, mode, str]);

  useEffect(() => () => refHandle.current?.stop(), []);
  // Listen lower than usual so a very slack low-E string still shows a reading.
  useEffect(() => {
    engine.setMinHz(55);
    return () => engine.setMinHz(78);
  }, []);

  const playRef = async () => {
    refHandle.current?.stop();
    const midi = mode === 'string' ? openMidi(str) : reading?.midiFloat ? Math.round(reading.midiFloat) : 64;
    const d = await engine.demonstrate([midi], 0, 'reference');
    refHandle.current = d.handle;
    setRefPlaying(true);
    window.setTimeout(() => setRefPlaying(false), (d.end - d.start) * 1000);
  };

  const sim = settings.inputMode === 'simulation';
  const cents = reading?.cents ?? null;
  const locked = reading?.status === 'inTune';
  const plain =
    reading === null
      ? mic === 'on' ? `Pluck string ${str} and let it ring.` : 'Start listening to tune.'
      : locked
        ? 'In tune — nice and steady.'
        : cents !== null && reading.direction
          ? reading.direction === 'up' ? `Too low — tighten slowly (${Math.abs(Math.round(cents))} cents)` : `Too high — loosen slowly (${Math.abs(Math.round(cents))} cents)`
          : reading.message;

  return (
    <section aria-label="Tuner" className="stack">
      <PageHead title="Tune" />
      {sim ? (
        <Callout kind="sim">Tuning needs a real microphone — the simulation can’t hear your guitar.</Callout>
      ) : (
        <ListenControl purpose="measure each string's pitch" />
      )}
      <label className="field">
        <span>Tuning</span>
        <select className="input" value={tuning} onChange={(e) => void updateSettings({ tuning: e.target.value as TuningChoice })}>
          {TUNINGS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      {tuning !== 'standard' && (
        <Callout kind="info">{tuningPreset(tuning).blurb} Lessons and the note checker expect standard tuning — tune back before a lesson.</Callout>
      )}
      {settings.advanced && (
        <Segmented label="Tuner mode" value={mode} options={[{ value: 'string', label: 'Guitar strings' }, { value: 'chromatic', label: 'Any note' }]} onChange={setMode} />
      )}
      <div className="tuner-layout">
      <div className="card stack amp" style={{ alignItems: 'stretch' }}>
        <div className="amp-plate" aria-hidden="true">
          <span className="t-logo">Guitar Unhero</span>
          <span className={`jewel${mic === 'on' ? ' on' : ''}`}>{mic === 'on' ? 'Listening' : 'Standby'}</span>
        </div>
        <div className="grille">
          <div className={`tuner-note${locked ? ' locked' : ''}`} aria-hidden="true">
            {reading?.noteName ? pitchClassName(Math.round(reading.midiFloat ?? 0)) : mode === 'string' ? pitchClassName(openMidi(str)) : '–'}
          </div>
          <Gauge cents={cents} locked={locked} />
        </div>
        <p role="status" aria-live="polite" data-testid="tuner-status" className={`t-card ${locked ? 'status-intune' : ''}`} style={{ textAlign: 'center', margin: 0 }}>
          {reading?.noteName && cents !== null ? `${reading.noteName}, ${Math.round(cents) === 0 ? 'centered' : `${Math.abs(Math.round(cents))} cents ${cents < 0 ? 'flat' : 'sharp'}`}${locked ? ', in tune' : ''}. ` : ''}
          {plain}
        </p>
        {mic === 'on' && <InputMeter compact />}
      </div>
      {mode === 'string' && (
        <>
          <div className="tuner-side">
          <Headstock str={str} tuned={tuned} locked={locked} onPick={setStr} names={{ 1: pitchClassName(openMidi(1)), 2: pitchClassName(openMidi(2)), 3: pitchClassName(openMidi(3)), 4: pitchClassName(openMidi(4)), 5: pitchClassName(openMidi(5)), 6: pitchClassName(openMidi(6)) }} />
          <div className="string-chips" role="group" aria-label="String to tune">
            {ORDER.map((s) => (
              <button key={s} type="button" aria-pressed={str === s} className={tuned.has(s) ? 'tuned' : ''} onClick={() => setStr(s)}>
                {pitchClassName(openMidi(s))}
                <small><span className="sr-only">string </span>{s}{tuned.has(s) ? ' ✓' : ''}<span className="sr-only">{tuned.has(s) ? ' tuned' : ''}</span></small>
              </button>
            ))}
          </div>
          <p className="t-small muted" style={{ margin: 0 }}>Thickest string (6) on the left. Turn a peg a little at a time and pluck again. If the note looks far away, check you plucked the right string — big turns can snap a string.</p>
          </div>
        </>
      )}
      </div>
      <div className="row">
        <button type="button" className="btn tonal" onClick={() => void playRef()} disabled={refPlaying}>
          <Icon name="volume" size={20} />{refPlaying ? 'Playing…' : 'Hear the right note'}
        </button>
        {refPlaying && <button type="button" className="btn outline" onClick={() => { refHandle.current?.stop(); setRefPlaying(false); }}>Stop</button>}
      </div>
    </section>
  );
}
