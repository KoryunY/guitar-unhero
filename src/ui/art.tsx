/**
 * Original illustrations for Guitar Unhero, drawn as inline SVG so they stay
 * crisp, theme-aware (CSS variables) and offline. Decorative art is
 * aria-hidden; anything that carries information has a text alternative.
 */
import { useId, type ReactNode } from 'react';

const PICK = 'M50 4C79 4 96 15 96 33C96 58 68 88 50 96C32 88 4 58 4 33C4 15 21 4 50 4Z';

/** App mark: a guitar pick with a lightning bolt. */
export function Logo({ size = 36, title }: { size?: number; title?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hot-1)" />
          <stop offset="1" stopColor="var(--hot-2)" />
        </linearGradient>
      </defs>
      <path d={PICK} fill={`url(#${id}g)`} />
      <path d="M57 14L30 54h17l-6 32 29-44H52z" fill="#fff" opacity="0.95" />
    </svg>
  );
}

export type Mood = 'happy' | 'rock' | 'wow' | 'sleepy' | 'proud' | 'think' | 'oops';

/** "Picky", the app's coach: a guitar pick with opinions. Purely decorative. */
export function Mascot({ mood = 'happy', size = 72 }: { mood?: Mood; size?: number }) {
  const id = useId();
  const eye = (cx: number) => {
    if (mood === 'sleepy' || mood === 'proud') return <path key={cx} d={`M${cx - 7} 40q7 ${mood === 'proud' ? -7 : 5} 14 0`} stroke="#1b1320" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
    const r = mood === 'wow' ? 8 : 6.5;
    const look = mood === 'think' ? -3 : 0;
    return (
      <g key={cx}>
        <circle cx={cx} cy={39} r={r} fill="#fff" />
        <circle cx={cx + (mood === 'think' ? 2 : 0)} cy={39 + look} r={r * 0.48} fill="#1b1320" />
      </g>
    );
  };
  const mouth: Record<Mood, ReactNode> = {
    happy: <path d="M38 55q12 11 24 0" stroke="#1b1320" strokeWidth="3.5" fill="none" strokeLinecap="round" />,
    proud: <path d="M36 54q14 13 28 0z" fill="#1b1320" />,
    rock: (
      <g>
        <path d="M37 53q13 18 26 0z" fill="#1b1320" />
        <path d="M45 60q5 9 10 0z" fill="#ff5d8f" />
      </g>
    ),
    wow: <ellipse cx="50" cy="59" rx="6" ry="8" fill="#1b1320" />,
    sleepy: <path d="M43 58h14" stroke="#1b1320" strokeWidth="3.5" strokeLinecap="round" />,
    think: <path d="M42 58q8-4 16 0" stroke="#1b1320" strokeWidth="3.5" fill="none" strokeLinecap="round" />,
    oops: <path d="M36 58q4-5 8 0t8 0 8 0 8 0" stroke="#1b1320" strokeWidth="3.2" fill="none" strokeLinecap="round" />,
  };
  return (
    <svg className={`mascot mood-${mood}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hot-1)" />
          <stop offset="1" stopColor="var(--hot-2)" />
        </linearGradient>
      </defs>
      <path d={PICK} fill={`url(#${id}m)`} stroke="#1b1320" strokeWidth="3" />
      <path d="M22 18q12-8 26-8" stroke="#fff" strokeOpacity="0.45" strokeWidth="5" fill="none" strokeLinecap="round" />
      {mood === 'rock' ? (
        <g>
          <path d="M24 33h52v6c0 8-6 12-12 12s-10-5-11-10h-6c-1 5-5 10-11 10s-12-4-12-12z" fill="#1b1320" />
          <path d="M30 37h10" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ) : (
        [36, 64].map(eye)
      )}
      {mouth[mood]}
      {mood === 'oops' && <path d="M80 26q4 8 0 11q-4-3 0-11z" fill="#7dd3fc" />}
      {mood === 'sleepy' && <text x="74" y="22" fontSize="16" fontWeight="800" fill="var(--muted)">z</text>}
      {mood === 'think' && <circle cx="84" cy="16" r="5" fill="var(--muted)" opacity="0.6" />}
    </svg>
  );
}

/**
 * Coach speech bubble: the plain instruction always comes first; the joke (if
 * the coach voice is not "plain") is an extra line, never a replacement.
 */
export function Coach({ mood = 'happy', joke, children, size = 64 }: { mood?: Mood; joke?: string | null; children?: ReactNode; size?: number }) {
  if (!children && !joke) return null;
  return (
    <div className="coach">
      <Mascot mood={mood} size={size} />
      <div className="bubble">
        {children}
        {joke && <p className="joke">{joke}</p>}
      </div>
    </div>
  );
}

/** Concert stage backdrop with light beams and a guitar silhouette (decorative). */
export function StageArt({ className, guitar = true }: { className?: string; guitar?: boolean }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--stage-1)" />
          <stop offset="1" stopColor="var(--stage-2)" />
        </linearGradient>
        <linearGradient id={`${id}beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hot-1)" />
          <stop offset="1" stopColor="var(--hot-2)" />
        </linearGradient>
      </defs>
      <rect width="400" height="160" fill={`url(#${id}sky)`} />
      {[60, 170, 290, 360].map((x, i) => (
        <path key={x} className="beam" style={{ animationDelay: `${i * 0.7}s` }} d={`M${x} -5L${x - 70 + i * 18} 160h${80 - i * 6}z`} fill={`url(#${id}beam)`} opacity="0.35" />
      ))}
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={i} cx={(i * 53) % 400} cy={(i * 37) % 70} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity="0.5" />
      ))}
      {/* crowd */}
      <path d="M0 160V142q10-12 20 0 8-14 18-2 10-12 22 0 10-14 20 0 9-10 18 0 10-14 22-1 10-12 20 0 10-13 20 0 8-12 18 0 10-14 22 0 10-12 20 0 10-14 22 0 9-10 18 0 10-14 22 0 8-12 18 0 10-12 20 0 10-14 22 0 9-12 18 0 10-14 22 0 10-12 20 0V160z" fill="#000" opacity="0.55" />
      {[48, 132, 251, 333].map((x) => (
        <path key={x} d={`M${x} 138l-3-16 4 0 2-6 2 6 4 0-3 16z`} fill="#000" opacity="0.55" />
      ))}
      {guitar && (
        <g transform="translate(206 34) rotate(-18)">
          <rect x="88" y="36" width="96" height="9" rx="2" fill="#5a3a22" />
          {Array.from({ length: 9 }, (_, i) => <rect key={i} x={98 + i * 9.5} y="36" width="1.5" height="9" fill="#d9d4cc" opacity="0.8" />)}
          <path d="M182 33l22-4 2 22-24-2z" fill="#1b1320" />
          <path d="M18 20C30 4 54 9 61 21c8-4 22-8 29 2 4 6-3 12-1 17-2 4 5 10 1 16-7 10-21 6-29 2-7 12-31 16-43 1C4 50 6 30 18 20z" fill={`url(#${id}body)`} stroke="#1b1320" strokeWidth="2.5" />
          <rect x="38" y="31" width="8" height="19" rx="2" fill="#1b1320" />
          <rect x="56" y="31" width="8" height="19" rx="2" fill="#1b1320" />
          <circle cx="28" cy="56" r="3.5" fill="#1b1320" />
          <circle cx="38" cy="61" r="3.5" fill="#1b1320" />
          {[0, 1, 2, 3, 4, 5].map((s) => <line key={s} x1="30" x2="196" y1={36.5 + s * 1.6} y2={36.5 + s * 1.6} stroke="#eee" strokeWidth="0.5" opacity="0.8" />)}
        </g>
      )}
    </svg>
  );
}

export type Tier = 'beginner' | 'improver' | 'intermediate' | 'advanced' | 'hero';

export const TIER_INFO: Record<Tier, { venue: string; tag: string }> = {
  beginner: { venue: 'The bedroom', tag: 'Where legends start (and neighbours complain)' },
  improver: { venue: 'The garage', tag: 'Door open, volume up' },
  intermediate: { venue: 'Open-mic night', tag: 'Three people and a dog are watching' },
  advanced: { venue: 'The club', tag: 'Sweaty, loud, glorious' },
  hero: { venue: 'The stadium', tag: 'Lighters up. Probably phone torches.' },
};

/** Small scene per journey tier (decorative). */
export function VenueArt({ tier, className }: { tier: Tier; className?: string }) {
  const id = useId();
  const sky: Record<Tier, [string, string]> = {
    beginner: ['#3b2a5c', '#7b4a8a'],
    improver: ['#2d3b55', '#5a6f8f'],
    intermediate: ['#2a1630', '#8a2a54'],
    advanced: ['#160f2a', '#4a1d7a'],
    hero: ['#0b0820', '#b5341c'],
  };
  const [a, b] = sky[tier];
  return (
    <svg className={className} viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill={`url(#${id}v)`} />
      {tier === 'beginner' && (
        <g>
          <rect x="16" y="20" width="34" height="28" rx="2" fill="#ffd27a" opacity="0.85" />
          <path d="M33 20v28M16 34h34" stroke="#3b2a5c" strokeWidth="2" />
          <rect x="0" y="66" width="160" height="24" fill="#2a1d3d" />
          <rect x="96" y="44" width="34" height="26" rx="3" fill="#1b1320" />
          <rect x="100" y="48" width="26" height="14" rx="2" fill="#4a3a2a" />
          {[103, 109, 115, 121].map((x) => <circle key={x} cx={x} cy="66" r="1.4" fill="#d9c8a0" />)}
          <path d="M70 70l18-40 4 2-14 38z" fill="#c98a4b" />
          <ellipse cx="72" cy="72" rx="10" ry="8" fill="#a0612d" />
        </g>
      )}
      {tier === 'improver' && (
        <g>
          <rect x="20" y="22" width="120" height="68" fill="#9aa7bd" />
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x="24" y={26 + i * 7} width="112" height="5" fill="#b9c4d6" />)}
          <rect x="24" y="68" width="112" height="22" fill="#1b1320" />
          <circle cx="60" cy="74" r="5" fill="#ffcb47" />
          <path d="M80 90l4-18h8l4 18z" fill="#000" opacity="0.7" />
        </g>
      )}
      {tier === 'intermediate' && (
        <g>
          <rect x="44" y="12" width="72" height="24" rx="6" fill="none" stroke="#ff4d9a" strokeWidth="3" />
          <text x="80" y="30" textAnchor="middle" fontSize="15" fontWeight="900" fill="#ff8ac0" letterSpacing="3">LIVE</text>
          <rect x="0" y="70" width="160" height="20" fill="#1b0f20" />
          <path d="M78 70V48M70 48h16" stroke="#cfcfcf" strokeWidth="2" />
          {[24, 40, 118, 136].map((x) => <circle key={x} cx={x} cy="66" r="6" fill="#000" opacity="0.6" />)}
        </g>
      )}
      {tier === 'advanced' && (
        <g>
          {[30, 80, 130].map((x, i) => (
            <path key={x} d={`M${x} 0L${x - 24} 90h48z`} fill={['#7c5cff', '#ff4d9a', '#22d3ee'][i]} opacity="0.3" />
          ))}
          <rect x="0" y="72" width="160" height="18" fill="#0b0716" />
          {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={8 + i * 13.5} cy="74" r="6" fill="#000" />)}
        </g>
      )}
      {tier === 'hero' && (
        <g>
          {[10, 50, 110, 150].map((x, i) => (
            <path key={x} d={`M${x} 0L${x + (i < 2 ? 30 : -30)} 90h-20z`} fill="#ffcb47" opacity="0.28" />
          ))}
          <rect x="30" y="54" width="100" height="10" fill="#1b1320" />
          {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={4 + i * 7.3} cy={80 + (i % 2) * 3} r="5" fill="#000" />)}
          {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={12 + i * 17} cy={70 + (i % 3) * 2} r="1.6" fill="#fff6b0" />)}
        </g>
      )}
    </svg>
  );
}

/** Rank badge: a shield with the rank number. */
export function RankBadge({ level, size = 56, max = 12 }: { level: number; size?: number; max?: number }) {
  const id = useId();
  const t = Math.min(1, (level - 1) / Math.max(1, max - 1));
  const fill = t > 0.75 ? ['#ffe08a', '#d18b00'] : t > 0.4 ? ['#ff9a5c', '#d1365e'] : ['#b7a6ff', '#6b4ed8'];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="rank-badge">
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fill[0]} />
          <stop offset="1" stopColor={fill[1]} />
        </linearGradient>
      </defs>
      <path d="M32 3l25 9v18c0 16-11 26-25 31C18 56 7 46 7 30V12z" fill={`url(#${id}r)`} stroke="#1b1320" strokeWidth="2.5" />
      <path d="M32 10l18 6v13c0 11-7 19-18 23" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
      <text x="32" y="40" textAnchor="middle" fontSize="22" fontWeight="900" fill="#1b1320" fontFamily="var(--font-display)">{level}</text>
    </svg>
  );
}

/** Streak flame with day count. */
export function Flame({ size = 28, lit = true }: { size?: number; lit?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2c2 6 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 4 5 0-4 0-7 1-11z" fill={lit ? 'var(--hot-1)' : 'var(--surface-3)'} />
      <path d="M16 14c1 3 5 5 5 9a5 5 0 0 1-10 0c0-3 2-4 3-6 0 2 1 3 2 3 0-2-1-4 0-6z" fill={lit ? '#ffd166' : 'var(--border)'} />
    </svg>
  );
}

/** Strum pattern on an eighth grid: D/U strums, d/u light, x chuck, - rest. */
export function StrumPattern({ pattern, active = -1 }: { pattern: string; active?: number }) {
  const slots = pattern.split('');
  const label = slots
    .map((c, i) => `${i % 2 === 0 ? `beat ${i / 2 + 1}` : 'and'}: ${c === 'D' ? 'down' : c === 'U' ? 'up' : c === 'd' ? 'light down' : c === 'u' ? 'light up' : c === 'x' ? 'muted chuck' : 'rest'}`)
    .join(', ');
  return (
    <div className="strum" role="img" aria-label={`Strum pattern: ${label}`}>
      {slots.map((c, i) => (
        <div key={i} className={`slot${i === active ? ' on' : ''}${c === '-' ? ' rest' : ''}`}>
          <svg viewBox="0 0 24 40" aria-hidden="true" className={c === 'd' || c === 'u' ? 'light' : ''}>
            {(c === 'D' || c === 'd') && <path d="M12 4v26M4 22l8 10 8-10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {(c === 'U' || c === 'u') && <path d="M12 36V10M4 18l8-10 8 10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {c === 'x' && <path d="M5 13l14 14M19 13L5 27" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />}
            {c === '-' && <circle cx="12" cy="20" r="2.5" fill="currentColor" />}
          </svg>
          <span>{i % 2 === 0 ? i / 2 + 1 : '&'}</span>
        </div>
      ))}
    </div>
  );
}

const FINGER_COLORS = ['var(--primary)', '#2563eb', '#16a34a', '#d97706', '#db2777'];

/**
 * Vertical chord box (the usual chord-chart view): low E on the left, high E on
 * the right (mirrored for left-handed players), nut on top.
 * `frets` index 0 = string 1 … 5 = string 6; null = do not play.
 */
export function ChordBox({ name, frets, fingers, leftHanded = false, size = 120 }: { name: string | null; frets: (number | null)[]; fingers?: (number | null)[]; leftHanded?: boolean; size?: number }) {
  const played = frets.filter((f): f is number => f !== null && f > 0);
  const minF = played.length ? Math.min(...played) : 1;
  const maxF = played.length ? Math.max(...played) : 1;
  const base = maxF <= 4 ? 1 : minF;
  const rows = Math.max(4, maxF - base + 1);
  const W = 100, top = 26, left = 16, gapX = 13.6, gapY = 16;
  // column for string s (1..6): string 6 left for right-handers
  const col = (s: number) => left + (leftHanded ? s - 1 : 6 - s) * gapX;
  const desc = `${name ?? 'Chord'}: ${[6, 5, 4, 3, 2, 1].map((s) => { const f = frets[s - 1]; return `string ${s} ${f === null || f === undefined ? 'not played' : f === 0 ? 'open' : `fret ${f}${fingers?.[s - 1] ? ` finger ${fingers[s - 1]}` : ''}`}`; }).join(', ')}.`;
  return (
    <figure className="chordbox" style={{ width: size }}>
      <svg viewBox={`0 0 ${W} ${top + rows * gapY + 10}`} role="img" aria-label={desc}>
        {base === 1 ? <rect x={left - 1.5} y={top - 4} width={gapX * 5 + 3} height="5" rx="1" fill="var(--text)" /> : <text x={left + gapX * 5 + 6} y={top + gapY * 0.7} fontSize="10" fill="var(--muted)">{base}fr</text>}
        {Array.from({ length: rows + 1 }, (_, r) => <line key={r} x1={left} x2={left + gapX * 5} y1={top + r * gapY} y2={top + r * gapY} stroke="var(--muted)" strokeWidth="1.2" />)}
        {[1, 2, 3, 4, 5, 6].map((s) => <line key={s} x1={col(s)} x2={col(s)} y1={top} y2={top + rows * gapY} stroke="var(--text)" strokeWidth={0.8 + (s - 1) * 0.25} />)}
        {[1, 2, 3, 4, 5, 6].map((s) => {
          const f = frets[s - 1];
          if (f === null || f === undefined) return <text key={s} x={col(s)} y={top - 9} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--incorrect)">×</text>;
          if (f === 0) return <circle key={s} cx={col(s)} cy={top - 13} r="4" fill="none" stroke="var(--correct)" strokeWidth="2" />;
          const fg = fingers?.[s - 1] ?? null;
          const cy = top + (f - base + 0.5) * gapY;
          return (
            <g key={s}>
              <circle cx={col(s)} cy={cy} r="6.4" fill={FINGER_COLORS[fg ?? 0]} />
              {fg && <text x={col(s)} y={cy + 3.6} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff">{fg}</text>}
            </g>
          );
        })}
      </svg>
      {name && <figcaption>{name}</figcaption>}
    </figure>
  );
}
