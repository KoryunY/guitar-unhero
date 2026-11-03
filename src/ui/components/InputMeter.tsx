import { useEffect, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import type { PitchFrame } from '../../audio/observations';

const MIN_DB = -80;
const pct = (db: number) => Math.max(0, Math.min(100, ((db - MIN_DB) / -MIN_DB) * 100));

/** Live input level with peak, gate and clipping indicators. */
export function InputMeter({ compact = false }: { compact?: boolean }) {
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
  const label = !frame ? 'No input signal yet' : clipHold ? 'Clipping — too loud' : rms < (frame.gateDb ?? -60) ? 'Quiet' : 'Signal';
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
      {!compact && (
        <p className="small muted" aria-live="polite">
          {label}
          {frame && ` · level ${Math.round(rms)} dBFS · background ${frame.noiseFloorDb === null ? '—' : Math.round(frame.noiseFloorDb)} dBFS`}
          {clipHold && ' · Lower the input gain or move the mic back.'}
        </p>
      )}
    </div>
  );
}
