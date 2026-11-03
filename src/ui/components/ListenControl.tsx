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
        <strong>Simulation mode.</strong> No microphone is used; simulated results are labeled and never count as real assessment.
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
    <div className={`callout ${err ? 'bad' : ''}`} data-testid="listen-control">
      {err ? (
        <>
          <strong role="alert">{err.title}</strong>
          <p className="small">{err.detail}</p>
        </>
      ) : (
        <p className="small" style={{ marginTop: 0 }}>
          {settings.inputMode === 'none' ? 'Listening is off. ' : ''}The microphone lets me {purpose}. Audio is analyzed on this device only and never uploaded or saved.
        </p>
      )}
      <div className="row">
        <button className="primary" onClick={start} disabled={busy || mic === 'requesting'}>
          {err ? 'Try again' : mic === 'requesting' ? 'Waiting for permission…' : 'Start listening'}
        </button>
        <button onClick={() => navigate('setup')}>Open Setup</button>
        <button onClick={() => updateSettings({ inputMode: 'simulation' })}>Use simulation instead</button>
      </div>
    </div>
  );
}
