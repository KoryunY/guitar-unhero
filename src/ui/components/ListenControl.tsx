import { useState } from 'react';
import { engine } from '../../audio/engine';
import { useApp } from '../AppContext';
import { navigate } from '../App';

/**
 * Shows the input source and lets the learner start listening (user gesture),
 * with recovery for denied/absent/busy/lost microphones. Never prompts repeatedly.
 */
export function ListenControl({ purpose }: { purpose: string }) {
  const { settings, mic, updateSettings } = useApp();
  const [busy, setBusy] = useState(false);
  if (settings.inputMode === 'simulation') {
    return (
      <div className="callout sim" data-testid="listen-sim">
        <div><strong>Simulation.</strong> Pretend playing — no microphone, and nothing here counts as your progress.</div>
      </div>
    );
  }
  const start = async () => {
    setBusy(true);
    updateSettings({ inputMode: 'microphone' });
    await engine.startMic(settings.deviceId);
    setBusy(false);
  };
  if (mic === 'on') return null;
  const err = engine.micError;
  return (
    <div className={`callout ${err ? 'bad' : ''}`} data-testid="listen-control" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      {err ? (
        <div>
          <strong role="alert">{err.title}</strong>
          <div className="t-small">{err.detail}</div>
        </div>
      ) : (
        <div className="t-small">
          {settings.inputMode === 'none' ? 'Mic is off. ' : ''}Turn on the mic and the app can {purpose}. Sound stays on this device.
        </div>
      )}
      <div className="row">
        <button type="button" className="btn primary" style={{ minHeight: 48 }} onClick={start} disabled={busy || mic === 'requesting'}>
          {err ? 'Try again' : mic === 'requesting' ? 'Waiting for permission…' : 'Start listening'}
        </button>
        {err && <button type="button" className="btn outline" onClick={() => navigate('settings', 'mic')}>Microphone settings</button>}
        {err && <button type="button" className="btn text" onClick={() => updateSettings({ inputMode: 'none' })}>Continue without listening</button>}
      </div>
    </div>
  );
}
