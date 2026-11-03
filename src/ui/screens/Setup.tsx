import { useEffect, useState } from 'react';
import { engine } from '../../audio/engine';
import { estimateLoopback } from '../../audio/calibration';
import { useApp } from '../AppContext';
import { InputMeter } from '../components/InputMeter';
import { ListenControl } from '../components/ListenControl';
import { navigate } from '../App';
import type { AttackObservation } from '../../audio/observations';

function yesNo(v: boolean | null): string {
  return v === null ? 'unknown' : v ? 'ON' : 'off';
}

export function Setup() {
  const { settings, updateSettings, mic, deltaIO } = useApp();
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [noise, setNoise] = useState<string | null>(null);
  const [cal, setCal] = useState<string | null>(null);
  const [calBusy, setCalBusy] = useState(false);

  useEffect(() => {
    engine.listInputs().then(setInputs).catch(() => setInputs([]));
    const md = navigator.mediaDevices;
    const on = () => engine.listInputs().then(setInputs).catch(() => undefined);
    md?.addEventListener?.('devicechange', on);
    return () => md?.removeEventListener?.('devicechange', on);
  }, [mic]);

  const pickDevice = async (id: string) => {
    updateSettings({ deviceId: id || null });
    if (mic === 'on') await engine.startMic(id || null);
  };

  const noiseCheck = async () => {
    setNoise('Measuring… keep the guitar quiet for 3 seconds.');
    const levels: number[] = [];
    let clipped = false;
    const off = engine.on('frame', (f) => {
      levels.push(f.rmsDb);
      clipped ||= f.clipped;
    });
    await new Promise((r) => setTimeout(r, 3000));
    off();
    if (!levels.length) return setNoise('No input arrived. Start listening first, or check the device.');
    const sorted = [...levels].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    const verdict = clipped ? 'Clipping detected even in silence — lower the input gain.' : median > -40 ? 'Noisy: background sound may hide quiet notes. Move closer to the guitar or reduce noise.' : median > -55 ? 'OK: some background sound.' : 'Quiet: good for listening.';
    setNoise(`Background level about ${Math.round(median)} dBFS. ${verdict}`);
  };

  const loopback = async () => {
    setCalBusy(true);
    setCal('Playing 8 clicks through your speakers. Keep the room quiet and do not play.');
    const ctx = await engine.ensureContext();
    const heard: AttackObservation[] = [];
    const off = engine.on('attack', (a) => heard.push(a));
    const start = ctx.currentTime + 0.4;
    const sched = Array.from({ length: 8 }, (_, i) => start + i * 0.6);
    sched.forEach((t) => engine.playClick(t, true));
    await new Promise((r) => setTimeout(r, (0.4 + 8 * 0.6 + 0.8) * 1000));
    off();
    const est = estimateLoopback(sched, heard.map((a) => a.onsetContextSec));
    setCalBusy(false);
    if (!est.ok) {
      setCal(`Calibration not saved: ${est.reason === 'too_few_pulses_heard' ? `only ${est.matched} of 8 clicks were heard (headphones prevent loopback — that's fine; use manual adjustment or keep timing approximate)` : `measurements were inconsistent (spread ${est.spreadMs} ms)`}.`);
      return;
    }
    updateSettings({
      calibration: {
        method: 'loopback', offsetMs: est.offsetMs!, spreadMs: est.spreadMs, samples: est.matched,
        deviceId: engine.track?.deviceId ?? null, sampleRate: engine.sampleRate, outputRoute: settings.outputRoute, createdAt: new Date().toISOString(),
      },
    });
    setCal(`Saved: output→input offset ${est.offsetMs} ms (spread ${est.spreadMs} ms, ${est.matched}/8 clicks). Applies to this input, sample rate and output route only.`);
  };

  const track = engine.track;
  return (
    <section aria-labelledby="setup-h">
      <h1 id="setup-h">Setup</h1>
      <div className="grid2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Microphone</h2>
          <ListenControl purpose="hear which note you play" />
          {mic === 'on' && (
            <>
              <p className="callout good" data-testid="mic-on">Listening with <strong>{track?.label}</strong>. Pluck a string — the meter should move.</p>
              <InputMeter />
              <p className="small muted">
                Browser processing actually applied — echo cancellation: {yesNo(track?.echoCancellation ?? null)}, noise suppression: {yesNo(track?.noiseSuppression ?? null)}, auto gain: {yesNo(track?.autoGainControl ?? null)}.
                {(track?.echoCancellation || track?.noiseSuppression || track?.autoGainControl) && ' The browser or device kept some voice processing on; notes may sound altered.'} Sample rate {engine.sampleRate} Hz.
              </p>
              <div className="row">
                <button onClick={noiseCheck}>Check background noise (3 s)</button>
              </div>
              {noise && <p aria-live="polite">{noise}</p>}
            </>
          )}
          <label>
            Input device{' '}
            <select value={settings.deviceId ?? ''} onChange={(e) => pickDevice(e.target.value)} aria-label="Input device">
              <option value="">System default</option>
              {inputs.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Input ${i + 1} (name shown after permission)`}</option>
              ))}
            </select>
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={() => { engine.stopMic(); updateSettings({ inputMode: 'none' }); }}>Continue without listening</button>
            <button onClick={() => updateSettings({ inputMode: 'simulation' })}>Use labeled simulation</button>
          </div>
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>How you hear the app</h2>
          <fieldset>
            <legend>Output</legend>
            <label><input type="radio" name="route" checked={settings.outputRoute === 'headphones'} onChange={() => updateSettings({ outputRoute: 'headphones' })} /> Headphones (recommended)</label><br />
            <label><input type="radio" name="route" checked={settings.outputRoute === 'speakers'} onChange={() => updateSettings({ outputRoute: 'speakers' })} /> Speakers</label><br />
            <label><input type="radio" name="route" checked={settings.outputRoute === 'unknown'} onChange={() => updateSettings({ outputRoute: 'unknown' })} /> Not sure</label>
          </fieldset>
          <p className="small">Headphones stop the app's own guide notes from reaching the microphone. On speakers, guide notes are muted while listening so the app never “hears itself”. Avoid Bluetooth headphones for timing practice — they add delay.</p>
          <h3>Timing calibration</h3>
          <p className="small" data-testid="calibration-status">
            {deltaIO === null
              ? 'Timing is uncalibrated: early/late feedback uses wide beginner windows and is labeled approximate.'
              : `Calibrated: ${Math.round(deltaIO * 1000)} ms (${settings.calibration?.method}).`}
          </p>
          <button onClick={loopback} disabled={mic !== 'on' || calBusy || settings.outputRoute === 'headphones'}>Measure with speaker clicks</button>
          {settings.outputRoute === 'headphones' && <p className="small muted">Loopback needs speakers; with headphones use the manual adjustment.</p>}
          {cal && <p aria-live="polite" className="small">{cal}</p>}
          <label className="small" style={{ display: 'block', marginTop: 8 }}>
            Manual timing adjustment (personal, not a precise latency measurement): {settings.calibration?.method === 'manual' ? settings.calibration.offsetMs : 0} ms
            <input
              type="range" min={-100} max={300} step={5}
              value={settings.calibration?.method === 'manual' ? settings.calibration.offsetMs : 0}
              onChange={(e) => updateSettings({ calibration: { method: 'manual', offsetMs: Number(e.target.value), spreadMs: null, samples: 0, deviceId: null, sampleRate: null, outputRoute: settings.outputRoute, createdAt: new Date().toISOString() } })}
              style={{ width: '100%' }}
              aria-label="Manual timing adjustment in milliseconds"
            />
          </label>
          {settings.calibration && <button onClick={() => updateSettings({ calibration: null })}>Clear calibration</button>}
        </div>
      </div>
      <div className="row">
        <button className="primary" onClick={() => navigate('tuner')}>Next: tune the guitar</button>
        <button onClick={() => navigate('learn')}>Go to lessons</button>
      </div>
    </section>
  );
}
