import { useEffect, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { analyzeClip, type ClipReport, type DiagnosticLabel } from '../../audio/diagnostics';
import { encodeWav16 } from '../../audio/wav';
import { midiName, openMidi } from '../../domain/tuning';
import type { StringNumber } from '../../domain/score';
import { useApp } from '../AppContext';
import { navigate, StatusChip } from '../App';
import { TopBar } from '../kit';
import { InputMeter } from '../components/InputMeter';
import { ListenControl } from '../components/ListenControl';

interface LogRow { id: string; t: number; note: string; cents: number | null; quality: string; reasons: string; latencyMs: number | null }

const TARGETS: { label: string; string: StringNumber; fret: number }[] = [
  ...([6, 5, 4, 3, 2, 1] as StringNumber[]).map((s) => ({ label: `String ${s} open (${midiName(openMidi(s))})`, string: s, fret: 0 })),
  { label: 'String 1, fret 1 (F4)', string: 1, fret: 1 },
  { label: 'String 1, fret 3 (G4)', string: 1, fret: 3 },
  { label: 'String 2, fret 1 (C4)', string: 2, fret: 1 },
  { label: 'String 2, fret 3 (D4)', string: 2, fret: 3 },
];

const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]! : null);

function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Hardware diagnostics: what the detector hears, how fast feedback arrives, and a
 * guided local recording that can be analyzed here or saved for the test suite.
 */
export function Diagnostics() {
  const { settings, mic, deltaIO } = useApp();
  const [rows, setRows] = useState<LogRow[]>([]);
  const latencies = useRef<number[]>([]);
  const [targetIdx, setTargetIdx] = useState(5);
  const [recState, setRecState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [clip, setClip] = useState<{ pcm: Float32Array; sampleRate: number; report: ClipReport; label: DiagnosticLabel } | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    return engine.on('attack', (a) => {
      if (a.simulated) return;
      const onsetPerf = engine.contextToPerformanceMs(a.onsetContextSec);
      const latency = onsetPerf === null ? null : Math.round(a.producedAtPerformanceMs - onsetPerf);
      if (latency !== null && latency > 0 && latency < 2000) latencies.current.push(latency);
      const nearest = a.pitchMidiFloat === null ? null : Math.round(a.pitchMidiFloat);
      setRows((r) => [
        {
          id: a.id,
          t: a.onsetContextSec,
          note: nearest === null ? '—' : midiName(nearest),
          cents: a.pitchMidiFloat === null || nearest === null ? null : Math.round((a.pitchMidiFloat - nearest) * 100),
          quality: a.quality,
          reasons: a.reasonCodes.join(', '),
          latencyMs: latency,
        },
        ...r.slice(0, 14),
      ]);
    });
  }, []);

  const target = TARGETS[targetIdx]!;
  const targetMidi = openMidi(target.string) + target.fret;

  const record = async () => {
    setClip(null);
    setRecState('recording');
    const secs = 8;
    setRemaining(secs);
    const timer = window.setInterval(() => setRemaining((x) => Math.max(0, x - 1)), 1000);
    try {
      const { pcm, sampleRate } = await engine.recordClip(secs);
      const report = analyzeClip(pcm, sampleRate, targetMidi, 4);
      const label: DiagnosticLabel = {
        format: 'gu-diagnostic-label', version: 1, targetMidi, string: target.string, fret: target.fret, requestedPlucks: 4,
        sampleRate, recordedAt: new Date().toISOString(), app: 'guitar-unhero 0.2.0',
      };
      setClip({ pcm, sampleRate, report, label });
      setRecState('done');
    } catch {
      setRecState('idle');
    } finally {
      window.clearInterval(timer);
    }
  };

  const ctx = engine.ctx;
  const lat = latencies.current;
  const sim = settings.inputMode === 'simulation';
  const base = `gu-${target.string}-${target.fret}-${clip?.label.recordedAt.replace(/[:.]/g, '-') ?? ''}`;

  return (
    <section aria-label="Mic test lab">
      <TopBar title="Mic test lab" back={() => navigate('settings')}><StatusChip /></TopBar>
      <p className="muted">For checking the app on your own guitar, microphone and room. Nothing here is uploaded.</p>
      {sim ? <p className="callout sim">Diagnostics need a real microphone; simulation has nothing to measure.</p> : <ListenControl purpose="measure what it hears from your guitar" />}

      <div className="grid2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Guided check</h2>
          <p className="small">Choose a target, press Record, then pluck it <strong>4 times</strong>, slowly, letting each note ring for about a second. It records 8 seconds.</p>
          <label>Target <select value={targetIdx} onChange={(e) => setTargetIdx(Number(e.target.value))} aria-label="Target note">
            {TARGETS.map((t, i) => <option key={t.label} value={i}>{t.label}</option>)}
          </select></label>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="primary" onClick={record} disabled={mic !== 'on' || recState === 'recording'} data-testid="diag-record">
              {recState === 'recording' ? `Recording… ${remaining}s` : 'Record 8 s'}
            </button>
            {recState === 'recording' && <button onClick={() => { engine.cancelRecording(); setRecState('idle'); }}>Cancel</button>}
          </div>
          {mic === 'on' && <InputMeter compact />}
          {clip && (
            <div data-testid="diag-report" style={{ marginTop: 10 }}>
              <p>
                Heard <strong>{clip.report.attacks}</strong> plucks (asked for 4). <strong>{clip.report.onTarget}</strong> matched {midiName(targetMidi)}
                {clip.report.wrongPitch ? `, ${clip.report.wrongPitch} sounded like another note` : ''}
                {clip.report.attacks - clip.report.pitched ? `, ${clip.report.attacks - clip.report.pitched} had no clear pitch` : ''}.
                {clip.report.medianCents !== null && ` Median ${clip.report.medianCents > 0 ? '+' : ''}${Math.round(clip.report.medianCents)} cents from the target.`}
                {clip.report.clipped && ' The recording clipped — lower the input level.'}
              </p>
              <p className="small muted">Steady pitch frames within ±15 cents: {clip.report.framesWithin15 === null ? 'none assessable' : `${Math.round(clip.report.framesWithin15 * 100)}% of ${clip.report.steadyFrames}`}. If the guitar is out of tune these numbers reflect the tuning, not the detector.</p>
              <table className="events small">
                <thead><tr><th>Time</th><th>Heard</th><th>Cents vs target</th><th>Quality</th></tr></thead>
                <tbody>{clip.report.details.map((d, i) => <tr key={i}><td>{d.onsetSec.toFixed(2)} s</td><td>{d.midi === null ? '—' : midiName(Math.round(d.midi))}</td><td>{d.cents === null ? '—' : Math.round(d.cents)}</td><td>{d.quality}{d.reasons.length ? ` (${d.reasons.join(', ')})` : ''}</td></tr>)}</tbody>
              </table>
              <div className="row" style={{ marginTop: 8 }}>
                <button onClick={() => download(`${base}.wav`, encodeWav16(clip.pcm, clip.sampleRate), 'audio/wav')}>Save recording (WAV)</button>
                <button onClick={() => download(`${base}.labels.json`, JSON.stringify(clip.label, null, 2), 'application/json')}>Save label (JSON)</button>
                <button onClick={() => { setClip(null); setRecState('idle'); }}>Discard</button>
              </div>
              <p className="small muted">Saved files stay on your computer. If you choose to share them with a developer, put both files in <code>tests/fixtures/recordings/</code> and run <code>pnpm test:recordings</code>.</p>
            </div>
          )}
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Feedback speed</h2>
          <p data-testid="diag-latency">
            {lat.length < 3
              ? 'Pluck a few single notes to measure how quickly a note is reported.'
              : `Onset → result: median ${pct(lat, 0.5)} ms, 95th percentile ${pct(lat, 0.95)} ms over ${lat.length} notes.`}
          </p>
          <p className="small muted">Approximate: includes audio input buffering, analysis (about 140 ms of sound is needed for a stable pitch) and message passing, measured against the output clock. The target is ≤200 ms (AC-11); low notes may be slower.</p>
          <h3>Devices</h3>
          <ul className="small">
            <li>Sample rate: {ctx?.sampleRate ?? '—'} Hz; output latency {ctx ? Math.round(((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000) : '—'} ms (browser estimate)</li>
            <li>Input: {engine.track?.label ?? '—'}; echo cancellation {String(engine.track?.echoCancellation ?? '—')}, noise suppression {String(engine.track?.noiseSuppression ?? '—')}, auto gain {String(engine.track?.autoGainControl ?? '—')}</li>
            <li>Output route: {settings.outputRoute}; timing {deltaIO === null ? 'uncalibrated' : `calibrated ${Math.round(deltaIO * 1000)} ms`}</li>
          </ul>
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Live note log</h2>
        <table className="events small" aria-label="Detected notes">
          <thead><tr><th>Time</th><th>Note</th><th>Cents</th><th>Quality</th><th>Latency</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={5} className="muted">Nothing heard yet.</td></tr> : rows.map((r) => (
              <tr key={r.id}><td>{r.t.toFixed(2)} s</td><td>{r.note}</td><td>{r.cents === null ? '—' : r.cents}</td><td>{r.quality}{r.reasons ? ` (${r.reasons})` : ''}</td><td>{r.latencyMs === null ? '—' : `${r.latencyMs} ms`}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
