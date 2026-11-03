import { useEffect, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { useApp } from '../AppContext';
import type { PitchFrame } from '../../audio/observations';

const MIN_DB = -80;
const pct = (db: number) => Math.max(0, Math.min(100, ((db - MIN_DB) / -MIN_DB) * 100));

/** Live input level with peak, gate and clipping indicators. */
export function InputMeter({ compact = false }: { compact?: boolean }) {
  const { settings } = useApp();
  const [frame, setFrame] = useState<PitchFrame | null>(engine.lastFrame);
  const [clipHold, setClipHold] = useState(false);
  const last = useRef(0);
  const clipTimer = useRef<number | null>(null);
  useEffect(() => {
    const off = engine.on('frame', (f) => {
      if (f.clipped) {
        setClipHold(true);
        if (clipTimer.current) window.clearTimeout(clipTimer.current);
        clipTimer.current = window.setTimeout(() => setClipHold(false), 1500);
      }
      const n = performance.now();
      if (n - last.current > 60) {
        last.current = n;
        setFrame(f);
      }
    });
    return () => {
      off();
      if (clipTimer.current) window.clearTimeout(clipTimer.current);
    };
  }, []);
  const rms = frame?.rmsDb ?? MIN_DB;
  const peak = frame?.peakDb ?? MIN_DB;
  const level = Math.round(pct(rms));
  const dead = frame?.reasonCodes.includes('no_input_signal');
  const label = !frame ? 'No input signal yet' : dead ? 'No sound is reaching the app — is the mic muted or its level at zero?' : clipHold ? 'Clipping — too loud' : rms < (frame.gateDb ?? -60) ? 'Quiet' : 'Signal';
  return (
    <div>
      <div
        className={`meter${clipHold ? ' clipping' : ''}`}
        role="meter"
        aria-label="Input level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={level}
        aria-valuetext={`${label}, ${Math.round(rms)} dBFS`}
      >
        <div className="fill" style={{ width: `${level}%` }} />
        {frame && <div className="gate" style={{ left: `${pct(frame.gateDb)}%` }} title="Detection threshold" />}
        <div className="peak" style={{ left: `${pct(peak)}%` }} />
      </div>
      {(!compact || dead) && (
        <p className="t-small muted" aria-live="polite" style={{ marginTop: 6 }}>
          {label}
          {frame && settings.advanced && ` · level ${Math.round(rms)} dBFS · background ${frame.noiseFloorDb === null ? '—' : Math.round(frame.noiseFloorDb)} dBFS`}
          {clipHold && ' · Lower the input gain or move the mic back.'}
        </p>
      )}
    </div>
  );
}
