/**
 * The living stage behind every screen (decorative, aria-hidden). Pure CSS layers:
 * a sky gradient, lamps with swaying beams, bokeh near and far, haze, a stage floor
 * with pools of light, film grain and a vignette. By day it is a sunlit bedroom
 * (window light on the wall, dust in the sun). The palette follows the learner's
 * current venue and the screen's mood. Hidden in high contrast and when stage
 * effects are off; still under reduced motion; paused while the tab is hidden.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import type { Tier } from './art';

export type BackdropMood = 'venue' | 'stage' | 'amp' | 'backstage' | 'studio';

const LAMPS: { x: number; delay: number; tone: 1 | 2 | 3; extra?: boolean }[] = [
  { x: 9, delay: 0, tone: 1 },
  { x: 31, delay: -3.2, tone: 2 },
  { x: 58, delay: -6.1, tone: 3, extra: true },
  { x: 74, delay: -1.6, tone: 1 },
  { x: 92, delay: -4.7, tone: 2, extra: true },
];

/** Dust specks: fixed positions so the layout is stable between renders. */
const DUST = [
  [12, 22, 0], [27, 68, -1.4], [41, 34, -2.6], [55, 80, -3.3], [66, 18, -0.8], [78, 52, -4.1], [88, 30, -2.2], [94, 74, -3.7], [20, 46, -4.6], [48, 58, -1.9],
] as const;

/** True when the day (light) look is showing, following the system when set to Auto. */
export function useDayLook(theme: 'system' | 'light' | 'stage'): boolean {
  const query = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined;
  const [systemDark, setSystemDark] = useState(() => !!query?.matches);
  useEffect(() => {
    if (!query) return;
    const on = () => setSystemDark(query.matches);
    query.addEventListener?.('change', on);
    return () => query.removeEventListener?.('change', on);
  }, [query]);
  return theme === 'light' || (theme === 'system' && !systemDark);
}

export function Backdrop({ tier, mood, day }: { tier: Tier; mood: BackdropMood; day: boolean }) {
  useEffect(() => {
    const root = document.documentElement;
    const on = () => {
      root.dataset.hidden = document.hidden ? 'true' : 'false';
    };
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  return (
    <div className={`backdrop${day ? ' day' : ''}`} data-tier={tier} data-mood={mood} aria-hidden="true">
      <div className="bd-sky" />
      <div className="bd-window" />
      <div className="bd-floor" />
      <div className="bd-rig">
        {LAMPS.map((l) => (
          <span key={l.x} className={`bd-lamp t${l.tone}${l.extra ? ' extra' : ''}`} style={{ '--x': `${l.x}%`, '--d': `${l.delay}s` } as CSSProperties}>
            <i className="cone" />
            <i className="flare" />
          </span>
        ))}
      </div>
      <div className="bd-bokeh far" />
      <div className="bd-bokeh near" />
      <div className="bd-haze" />
      <div className="bd-dust">
        {DUST.map(([x, y, d]) => (
          <i key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
        ))}
      </div>
      <svg className="bd-grain" width="100%" height="100%">
        <filter id="bd-grain-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#bd-grain-noise)" />
      </svg>
      <div className="bd-vignette" />
    </div>
  );
}
