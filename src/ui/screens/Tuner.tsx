import { useEffect, useMemo, useRef, useState } from 'react';
import { engine, type Handle } from '../../audio/engine';
import { TunerTracker, type TunerReading } from '../../audio/tuner';
import { STRING_LABELS, openMidi } from '../../domain/tuning';
import type { StringNumber } from '../../domain/score';
import { useApp } from '../AppContext';
import { InputMeter } from '../components/InputMeter';
import { ListenControl } from '../components/ListenControl';
import { navigate } from '../App';

const ORDER: StringNumber[] = [6, 5, 4, 3, 2, 1];

export function TunerScreen() {
  const { settings, mic } = useApp();
  const [mode, setMode] = useState<'string' | 'chromatic'>('string');
  const [str, setStr] = useState<StringNumber>(6);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [refPlaying, setRefPlaying] = useState(false);
  const tracker = useMemo(() => new TunerTracker({ mode: 'string', targetMidi: openMidi(6), targetString: 6 }), []);
  const refHandle = useRef<Handle | null>(null);
  const lastUi = useRef(0);

  useEffect(() => {
    tracker.setOptions(mode === 'string' ? { mode, targetMidi: openMidi(str), targetString: str } : { mode });
    setReading(null);
  }, [mode, str, tracker]);

  useEffect(() => {
    const off = engine.on('frame', (f) => {
      // While the reference tone plays, the tuner must not lock onto the app's own sound.
      if (f.reasonCodes.includes('app_sound_playing')) {
        tracker.reset();
        setReading({ status: 'silent', message: 'Reference tone playing — tuner paused.', hz: null, midiFloat: null, noteName: null, cents: null, targetMidi: null, direction: null, reasonCodes: ['app_sound_playing'] });
        return;
      }
      const r = tracker.push(f);
      const n = performance.now();
      if (n - lastUi.current > 50 || r.status !== reading?.status) {
        lastUi.current = n;
        setReading(r);
      }
    });
    return off;
  }, [tracker, reading?.status]);

  useEffect(() => () => refHandle.current?.stop(), []);

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
  const needle = cents === null ? 50 : Math.max(0, Math.min(100, 50 + cents));
  const locked = reading?.status === 'inTune';
  const gaugeText =
    reading === null
      ? 'No reading yet.'
      : cents === null
        ? reading.message
        : `${reading.noteName}, ${Math.round(cents) === 0 ? 'centered' : `${Math.abs(Math.round(cents))} cents ${cents < 0 ? 'flat' : 'sharp'}`}${locked ? ', in tune' : ''}.`;

  return (
    <section aria-labelledby="tuner-h">
      <h1 id="tuner-h">Tuner</h1>
      {sim ? (
        <div className="callout sim">The tuner needs a real microphone. Simulation cannot tune your guitar — choose “Start listening” in Setup when you have a microphone.</div>
      ) : (
        <ListenControl purpose="measure each string's pitch" />
      )}
      <div className="panel">
        <div className="row" role="group" aria-label="Tuner mode">
          <button aria-pressed={mode === 'string'} onClick={() => setMode('string')}>Selected string</button>
          <button aria-pressed={mode === 'chromatic'} onClick={() => setMode('chromatic')}>Chromatic</button>
        </div>
        {mode === 'string' && (
          <div className="string-buttons" role="group" aria-label="String to tune" style={{ marginTop: 10 }}>
            {ORDER.map((s) => (
              <button key={s} aria-pressed={str === s} onClick={() => setStr(s)}>
                {s} · {STRING_LABELS[s].name}
                <span className="small muted" style={{ display: 'block' }}>{STRING_LABELS[s].nickname}</span>
              </button>
            ))}
          </div>
        )}
        <div className="tuner-readout">
          <div className="tuner-note" aria-hidden="true">{reading?.noteName ?? '—'}</div>
          <div className="tuner-gauge" aria-hidden="true">
            <div className="zone" />
            <div className="center" />
            {cents !== null && <div className={`needle${locked ? ' locked' : ''}`} style={{ left: `${needle}%` }} />}
          </div>
          <p className="small muted" aria-hidden="true">← flat (too low) · sharp (too high) →</p>
          <p role="status" aria-live="polite" data-testid="tuner-status" className={locked ? 'status-intune' : ''}>
            {gaugeText} {cents !== null ? reading?.message : ''}
          </p>
          {mode === 'string' && <p className="small">Target: string {str} — {STRING_LABELS[str].name} ({STRING_LABELS[str].nickname}).</p>}
        </div>
        {mic === 'on' && <InputMeter compact />}
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={playRef} disabled={refPlaying}>{refPlaying ? 'Playing reference…' : `Play reference tone${mode === 'string' ? ` (${STRING_LABELS[str].name})` : ''}`}</button>
          {refPlaying && <button onClick={() => { refHandle.current?.stop(); setRefPlaying(false); }}>Stop tone</button>}
        </div>
        <p className="small muted">
          Turn pegs in small steps and pluck again after each turn. If the reading looks an octave away or far off, check which string you plucked rather than turning a lot — overtightening can break strings.
          Listening pauses while the reference tone plays.
        </p>
      </div>
      <button className="primary" onClick={() => navigate('learn')}>Next: first lesson</button>
    </section>
  );
}
