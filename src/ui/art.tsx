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
        <g className="stage-guitar" transform="translate(206 34) rotate(-18)">
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

/** Rows of heads (and a few raised hands) for crowd silhouettes. */
function crowdPath(y: number, from: number, to: number, step: number, r: number): string {
  let d = '';
  for (let x = from, i = 0; x <= to; x += step, i++) {
    const h = y + ((i * 7) % 3) * 2;
    d += `M${x - r} ${h + r * 3}a${r} ${r} 0 1 1 ${2 * r} 0V${h + r * 6}h${-2 * r}z`;
    d += `M${x - r * 0.9} ${h + r * 0.2}a${r * 0.9} ${r * 0.9} 0 1 0 ${r * 1.8} 0a${r * 0.9} ${r * 0.9} 0 1 0 ${-r * 1.8} 0z`;
    if (i % 5 === 2) d += `M${x + r * 0.8} ${h + r * 1.6}l${r * 0.9} ${-r * 3.2}l${r * 0.7} ${r * 0.2}l${-r * 0.6} ${r * 3.4}z`;
  }
  return d;
}

/**
 * Wide scene per journey venue (decorative), drawn for banners: 1000×150 with
 * the landmarks on the right, so narrow cards (which keep the right side) still
 * show the room and wide banners show the whole place.
 */
export function VenueArt({ tier, className }: { tier: Tier; className?: string }) {
  const id = useId();
  const g = (n: string) => `${id}${n}`;
  const u = (n: string) => `url(#${g(n)})`;
  const bulbs = ['#ffcb47', '#ff4d9a', '#7dd3fc', '#4ade80'];
  return (
    <svg className={className} viewBox="0 0 1000 150" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={g('hot')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff7a2f" /><stop offset="1" stopColor="#e3266f" /></linearGradient>
        <linearGradient id={g('lamp')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd27a" stopOpacity="0.5" /><stop offset="1" stopColor="#ffd27a" stopOpacity="0" /></linearGradient>
        <linearGradient id={g('beam')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.45" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id={g('sky1')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c1f48" /><stop offset="1" stopColor="#70417f" /></linearGradient>
        <linearGradient id={g('sky2')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d2840" /><stop offset="1" stopColor="#5a6f8f" /></linearGradient>
        <linearGradient id={g('inside')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb35c" stopOpacity="0.55" /><stop offset="1" stopColor="#1b1320" stopOpacity="0.95" /></linearGradient>
        <linearGradient id={g('sky3')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a0f1e" /><stop offset="1" stopColor="#5a1838" /></linearGradient>
        <linearGradient id={g('sky4')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0e0a22" /><stop offset="1" stopColor="#40186e" /></linearGradient>
        <linearGradient id={g('sky5')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b0820" /><stop offset="0.7" stopColor="#5a1a2a" /><stop offset="1" stopColor="#b5341c" /></linearGradient>
        <linearGradient id={g('gold')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe7a0" stopOpacity="0.55" /><stop offset="1" stopColor="#ffcb47" stopOpacity="0" /></linearGradient>
        <pattern id={g('brick')} width="40" height="16" patternUnits="userSpaceOnUse">
          <rect width="40" height="16" fill="#3a1424" />
          <path d="M0 0.5H40M0 8.5H40M10 0.5V8.5M30 8.5V16" stroke="#2a0c18" strokeWidth="1.4" />
        </pattern>
      </defs>

      {tier === 'beginner' && (
        <g>
          <rect width="1000" height="150" fill={u('sky1')} />
          <path d="M300 12Q380 38 460 16T620 20T780 14T940 22T1000 14" stroke="#1d1430" strokeWidth="1.6" fill="none" />
          {[330, 380, 430, 480, 530, 585, 640, 700, 760, 820, 880, 940].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={22 + ((i * 5) % 9)} r="8" fill={bulbs[i % 4]} opacity="0.22" />
              <circle cx={x} cy={22 + ((i * 5) % 9)} r="3" fill={bulbs[i % 4]} />
            </g>
          ))}
          <rect x="560" y="26" width="96" height="72" rx="3" fill="#191334" />
          <circle cx="634" cy="46" r="11" fill="#fff3c4" />
          <circle cx="628" cy="43" r="11" fill="#191334" />
          {[[574, 40], [592, 74], [612, 34], [646, 80]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.2" fill="#fff" />)}
          <path d="M608 26v72M560 60h96" stroke="#4a3570" strokeWidth="3" />
          <rect x="556" y="22" width="104" height="80" rx="4" fill="none" stroke="#4a3570" strokeWidth="5" />
          <rect x="684" y="46" width="38" height="52" rx="2" fill="#e3266f" opacity="0.7" />
          <path d="M707 52l-12 20h8l-4 18 14-22h-8z" fill="#fff" opacity="0.85" />
          <rect x="730" y="56" width="30" height="38" rx="2" fill="#ffcb47" opacity="0.55" />
          <rect x="420" y="58" width="110" height="6" rx="2" fill="#4a3570" />
          {[426, 436, 446, 456, 470, 482].map((x, i) => <rect key={x} x={x} y={36 + (i % 2) * 4} width="8" height={22 - (i % 2) * 4} rx="1" fill={['#ff7a2f', '#7dd3fc', '#ffcb47', '#c79bff', '#4ade80', '#ff4d9a'][i]} opacity="0.7" />)}
          <rect x="0" y="120" width="1000" height="30" fill="#1d1433" />
          <ellipse cx="640" cy="134" rx="120" ry="10" fill="#3a2458" />
          <rect x="370" y="98" width="150" height="28" rx="8" fill="#4b2f6a" />
          <rect x="378" y="90" width="44" height="16" rx="6" fill="#8d6fb3" />
          <path d="M806 56L774 134H868L836 56z" fill={u('lamp')} />
          <path d="M808 56h26l-6-18h-14z" fill="#ffcb47" />
          <path d="M821 56v68M810 124h22" stroke="#c9b48a" strokeWidth="2.5" />
          <rect x="868" y="84" width="72" height="46" rx="4" fill="#120c1c" />
          <rect x="875" y="96" width="58" height="30" rx="2" fill="#3b2b22" />
          {[882, 890, 898].map((x) => <circle key={x} cx={x} cy="90" r="2" fill="#d9c8a0" />)}
          <g transform="translate(966 62) rotate(14)">
            <rect x="4" y="-48" width="6" height="64" rx="2" fill="#5a3a22" />
            <path d="M-12 14c-2-10 10-14 14-6 4-8 16-4 14 6 6 4 4 20-14 22C-14 36-18 20-12 14z" fill={u('hot')} stroke="#1b1320" strokeWidth="2" />
          </g>
        </g>
      )}

      {tier === 'improver' && (
        <g>
          <rect width="1000" height="150" fill={u('sky2')} />
          {[[120, 24], [220, 14], [300, 40], [380, 20], [450, 34]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.3" fill="#fff" opacity="0.7" />)}
          <circle cx="250" cy="44" r="14" fill="#ffe7b0" opacity="0.18" />
          <path d="M470 34L725 10L980 34V150H470z" fill="#8c98ae" />
          <path d="M470 34L725 10L980 34" stroke="#3a4560" strokeWidth="6" fill="none" />
          <rect x="520" y="48" width="410" height="102" fill="#11101a" />
          <rect x="520" y="48" width="410" height="102" fill={u('inside')} />
          {[0, 1, 2, 3].map((i) => <rect key={i} x="520" y={48 + i * 9} width="410" height="8" fill={i % 2 ? '#a6b2c6' : '#b9c4d6'} />)}
          <rect x="566" y="98" width="42" height="46" rx="3" fill="#0c0a12" />
          <rect x="566" y="82" width="42" height="18" rx="2" fill="#0c0a12" />
          <rect x="571" y="104" width="32" height="34" rx="2" fill="#2a2230" />
          <circle cx="700" cy="126" r="19" fill="#0c0a12" />
          <circle cx="700" cy="126" r="13" fill="#1f1a28" />
          <ellipse cx="742" cy="106" rx="17" ry="5" fill="#0c0a12" />
          <path d="M742 106v38M660 110l14 0" stroke="#0c0a12" strokeWidth="3" />
          <path d="M830 82V98" stroke="#2a2230" strokeWidth="2" />
          <circle cx="830" cy="104" r="7" fill="#ffcb47" />
          <circle cx="830" cy="104" r="26" fill="#ffcb47" opacity="0.16" />
          <rect x="870" y="84" width="48" height="40" rx="2" fill="#2a2230" />
          {[876, 888, 900, 910].map((x, i) => <path key={x} d={`M${x} 90v${12 + (i % 2) * 8}`} stroke="#8c98ae" strokeWidth="2.5" />)}
          <rect x="0" y="140" width="1000" height="10" fill="#1b2233" />
        </g>
      )}

      {tier === 'intermediate' && (
        <g>
          <rect width="1000" height="150" fill={u('sky3')} />
          <rect x="300" y="0" width="700" height="150" fill={u('brick')} opacity="0.85" />
          <rect x="300" y="0" width="700" height="150" fill={u('sky3')} opacity="0.35" />
          <path d="M640 0L572 150H708z" fill={u('beam')} opacity="0.6" />
          <g>
            <rect x="770" y="22" width="120" height="42" rx="10" fill="none" stroke="#ff4d9a" strokeWidth="9" opacity="0.25" />
            <rect x="770" y="22" width="120" height="42" rx="10" fill="none" stroke="#ff8ac0" strokeWidth="3" />
            <text x="830" y="52" textAnchor="middle" fontSize="24" fontWeight="900" fill="#ffd0e6" letterSpacing="5" fontFamily="system-ui, sans-serif">LIVE</text>
          </g>
          <rect x="0" y="122" width="1000" height="28" fill="#1b0f20" />
          <rect x="560" y="116" width="170" height="8" rx="2" fill="#2e1830" />
          <path d="M640 116V74M630 74h20" stroke="#d6d0dc" strokeWidth="2.5" />
          <circle cx="640" cy="72" r="5" fill="#2a2230" stroke="#d6d0dc" strokeWidth="1.5" />
          <path d="M676 116V98h22v18M680 98v18M694 98v18" stroke="#3b2a3e" strokeWidth="3" fill="none" />
          <path d={crowdPath(118, 330, 530, 34, 6)} fill="#0e0710" />
          <path d={crowdPath(118, 760, 990, 34, 6)} fill="#0e0710" />
          {[380, 450, 820, 900].map((x) => <g key={x}><rect x={x - 16} y="126" width="32" height="4" rx="2" fill="#2e1830" /><circle cx={x} cy="122" r="5" fill="#ffcb47" opacity="0.25" /><circle cx={x} cy="122" r="1.8" fill="#ffe08a" /></g>)}
        </g>
      )}

      {tier === 'advanced' && (
        <g>
          <rect width="1000" height="150" fill={u('sky4')} />
          {([[560, '#7c5cff'], [700, '#ff4d9a'], [820, '#22d3ee'], [940, '#7c5cff']] as const).map(([x, c], i) => (
            <path key={x} d={`M${x} 0L${x - 70 + i * 30} 150h${80 - i * 10}z`} fill={c} opacity="0.28" />
          ))}
          {[[620, 30], [760, 18], [880, 40]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="22" fill="#ff4d9a" opacity="0.08" />)}
          <rect x="520" y="70" width="40" height="64" rx="3" fill="#0b0716" stroke="#2a1f44" strokeWidth="2" />
          <rect x="950" y="70" width="40" height="64" rx="3" fill="#0b0716" stroke="#2a1f44" strokeWidth="2" />
          {[540, 970].map((x) => <g key={x}><circle cx={x} cy="88" r="9" fill="#1a1230" /><circle cx={x} cy="116" r="12" fill="#1a1230" /></g>)}
          <rect x="560" y="96" width="390" height="10" fill="#140c26" />
          <path d={crowdPath(112, 300, 1000, 22, 7)} fill="#05030c" />
          <rect x="0" y="138" width="1000" height="12" fill="#05030c" />
        </g>
      )}

      {tier === 'hero' && (
        <g>
          <rect width="1000" height="150" fill={u('sky5')} />
          <rect x="360" y="10" width="640" height="8" fill="#14101c" />
          <path d={Array.from({ length: 32 }, (_, i) => `M${360 + i * 20} 10l10 8l10-8`).join('')} stroke="#2a2433" strokeWidth="1.5" fill="none" />
          {Array.from({ length: 9 }, (_, i) => 400 + i * 70).map((x, i) => (
            <g key={x}>
              <path d={`M${x} 18L${x + (i < 4 ? -60 : 60) + (i - 4) * 4} 150h50z`} fill={u('gold')} opacity="0.5" />
              <circle cx={x} cy="20" r="4" fill="#fff6d0" />
            </g>
          ))}
          <rect x="560" y="72" width="300" height="12" fill="#1b1320" />
          <rect x="420" y="44" width="70" height="44" rx="3" fill="#1b1320" stroke="#ff7a2f" strokeWidth="2" />
          <rect x="930" y="44" width="70" height="44" rx="3" fill="#1b1320" stroke="#ff7a2f" strokeWidth="2" />
          <rect x="426" y="50" width="58" height="32" fill="#ff7a2f" opacity="0.25" />
          <rect x="936" y="50" width="58" height="32" fill="#ff7a2f" opacity="0.25" />
          <path d={crowdPath(100, 280, 1000, 16, 6)} fill="#06040a" />
          <path d={crowdPath(116, 290, 1000, 15, 6)} fill="#030206" />
          {Array.from({ length: 26 }, (_, i) => 300 + i * 27).map((x, i) => <circle key={x} cx={x} cy={100 + (i % 3) * 5} r="1.8" fill="#fff6b0" />)}
          {[[880, 26], [930, 18], [970, 32]].map(([x, y]) => (
            <g key={x} stroke="#ffcb47" strokeWidth="1.5" opacity="0.8">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d={`M${x} ${y}l${Math.cos((a * Math.PI) / 180) * 8} ${Math.sin((a * Math.PI) / 180) * 8}`} />)}
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/** "Lesson cleared" confetti: falling guitar picks (decorative, pointer-transparent). */
export function PickConfetti({ count = 26 }: { count?: number }) {
  const colors = ['#ff7a2f', '#ffcb47', '#e3266f', '#c79bff', '#4ade80', '#7dd3fc', '#ff8a4c'];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${((i * 13) % 20) / 10}s`,
            animationDuration: `${2.6 + ((i * 7) % 12) / 10}s`,
            width: 12 + (i % 3) * 3,
            height: 13 + (i % 3) * 3,
          }}
        />
      ))}
    </div>
  );
}

/**
 * The guitar's parts, seen from the front as it faces you on a stand: headstock on
 * the left, string 6 on top (nearest the ceiling), string 1 below. Mirrored for
 * left-handed players; labels stay readable.
 */
export function GuitarParts({ leftHanded = false }: { leftHanded?: boolean }) {
  const id = useId();
  const pin = (n: number, x: number, y: number, tx: number, ty: number, label: string, toY: number) => (
    <g key={n}>
      <path d={`M${x} ${y > toY ? y - 14 : y + 14}V${toY}`} stroke="#ff8a4c" strokeWidth="2" strokeDasharray="3 3" />
      <circle cx={x} cy={y} r="14" fill={`url(#${id}pin)`} />
      <text x={x} y={y + 5} textAnchor="middle" fill="#fff" fontWeight="800" fontSize="14" transform={leftHanded ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>{n}</text>
      <text x={tx} y={ty} fill="var(--text)" fontWeight="700" fontSize="14" transform={leftHanded ? `translate(${2 * tx} 0) scale(-1 1)` : undefined} textAnchor={leftHanded ? 'end' : 'start'}>{label}</text>
    </g>
  );
  return (
    <figure className="guitar-parts">
      <svg viewBox="0 0 640 270" role="img" aria-label={`An acoustic guitar seen from the front, headstock on the ${leftHanded ? 'right' : 'left'}. 1: headstock and tuning pegs. 2: neck and frets. 3: body and sound hole. 4: the six strings — string 6 (thickest) on top, string 1 (thinnest) below.`}>
        <defs>
          <radialGradient id={`${id}spot`} cx="0.6" cy="0.5" r="0.6"><stop offset="0" stopColor="#ffb070" stopOpacity="0.25" /><stop offset="1" stopColor="#ffb070" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${id}wood`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9b77a" /><stop offset="1" stopColor="#b0692f" /></linearGradient>
          <linearGradient id={`${id}neck`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b3520" /><stop offset="1" stopColor="#3b2214" /></linearGradient>
          <linearGradient id={`${id}pin`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff7a2f" /><stop offset="1" stopColor="#e3266f" /></linearGradient>
        </defs>
        <g transform={leftHanded ? 'translate(640 0) scale(-1 1)' : undefined} fontFamily="system-ui, sans-serif">
          <rect width="640" height="270" fill={`url(#${id}spot)`} />
          <ellipse cx="380" cy="248" rx="250" ry="9" fill="#000" opacity="0.25" />
          <path d="M372 140C372 80 404 62 440 72C462 78 476 86 494 80C544 50 616 60 616 140C616 220 544 230 494 200C476 194 462 202 440 208C404 218 372 200 372 140Z" fill={`url(#${id}wood)`} stroke="#3a2414" strokeWidth="3" />
          <path d="M380 140C380 88 408 74 440 82" stroke="#fff" strokeOpacity="0.25" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="456" cy="140" r="33" fill="none" stroke="#7a4a24" strokeWidth="4" />
          <circle cx="456" cy="140" r="26" fill="#1d120a" />
          <rect x="548" y="114" width="16" height="52" rx="4" fill="#3a2414" />
          <rect x="553" y="118" width="3" height="44" fill="#efe6d6" />
          <rect x="98" y="122" width="290" height="36" fill={`url(#${id}neck)`} />
          <path d="M128 122v36M156 122v36M183 122v36M208 122v36M232 122v36M254 122v36M275 122v36M295 122v36M314 122v36M332 122v36M349 122v36M365 122v36" stroke="#cfc8bd" strokeWidth="2.4" />
          {[169.5, 220, 264.5, 304.5].map((x) => <circle key={x} cx={x} cy="140" r="3.2" fill="#efe6d6" />)}
          <circle cx="357" cy="132" r="3" fill="#efe6d6" />
          <circle cx="357" cy="148" r="3" fill="#efe6d6" />
          <rect x="93" y="120" width="6" height="40" rx="1.5" fill="#efe6d6" />
          <path d="M22 112L93 120V160L22 168Z" fill="#3a2414" stroke="#24150b" strokeWidth="2" />
          <g fill="#d8d2c8" stroke="#6d665c" strokeWidth="1.5">
            {[[36, 104], [56, 106], [76, 108], [36, 176], [56, 174], [76, 172]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="6" />)}
          </g>
          <path d="M36 124L96 125H556" stroke="#d4a35c" strokeWidth="2.4" fill="none" />
          <path d="M56 126L96 131H556" stroke="#d4a35c" strokeWidth="2.1" fill="none" />
          <path d="M76 128L96 137H556" stroke="#d4a35c" strokeWidth="1.8" fill="none" />
          <path d="M76 152L96 143H556" stroke="#ece6da" strokeWidth="1.5" fill="none" />
          <path d="M56 154L96 149H556" stroke="#ece6da" strokeWidth="1.2" fill="none" />
          <path d="M36 156L96 155H556" stroke="#ece6da" strokeWidth="0.9" fill="none" />
          {pin(1, 56, 44, 76, 40, 'Headstock & pegs', 96)}
          {pin(2, 232, 44, 252, 40, 'Neck & frets', 118)}
          {pin(3, 456, 242, 476, 247, 'Body & sound hole', 176)}
          {pin(4, 180, 228, 200, 233, 'Strings: 6 on top, 1 below', 160)}
        </g>
      </svg>
    </figure>
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
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={lit ? 'flame-lit' : undefined}>
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

/** Home studio: a song waveform with sections above a small mixing desk (decorative). */
export function StudioArt() {
  const id = useId();
  const bars = Array.from({ length: 38 }, (_, i) => {
    const x = 44 + i * 10;
    const up = 10 + ((i * 37) % 23) + (i % 7 === 3 ? 10 : 0);
    const down = 8 + ((i * 29) % 21) + (i % 5 === 1 ? 8 : 0);
    return `M${x} 68V${68 - up * 0.9}M${x} 68V${68 + down * 0.9}`;
  }).join('');
  return (
    <svg viewBox="0 0 460 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}desk`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1426" /><stop offset="1" stopColor="#271238" /></linearGradient>
        <linearGradient id={`${id}wave`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#22d3ee" /><stop offset="0.5" stopColor="#ff7a2f" /><stop offset="1" stopColor="#e3266f" /></linearGradient>
        <linearGradient id={`${id}vu`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#4ade80" /><stop offset="0.7" stopColor="#ffcb47" /><stop offset="1" stopColor="#ff7a6e" /></linearGradient>
      </defs>
      <rect width="460" height="250" fill={`url(#${id}desk)`} />
      <rect x="30" y="20" width="400" height="96" rx="10" fill="#090b14" stroke="#2b3550" strokeWidth="2" />
      <path d={bars} stroke={`url(#${id}wave)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M174 24V112" stroke="#fff" strokeWidth="2" opacity="0.8" />
      <g fontFamily="Bebas Neue, Impact, sans-serif" fontSize="13" fill="#9fb0d0" letterSpacing="1">
        <text x="48" y="36">VERSE</text>
        <text x="180" y="36">CHORUS</text>
        <text x="318" y="36">VERSE</text>
      </g>
      <rect x="30" y="128" width="400" height="104" rx="10" fill="#141827" stroke="#2b3550" strokeWidth="2" />
      {([[56, 170], [100, 152], [144, 186], [188, 162], [232, 178]] as const).map(([x, y], i) => (
        <g key={x}>
          <rect x={x} y="144" width="6" height="72" rx="3" fill="#0a0c14" />
          <rect x={x - 8} y={y} width="22" height="12" rx="3" fill={i === 3 ? '#ff8a4c' : '#cfd6e6'} />
        </g>
      ))}
      <rect x="290" y="144" width="14" height="72" rx="3" fill="#0a0c14" />
      <rect x="292" y="170" width="10" height="44" rx="2" fill={`url(#${id}vu)`} />
      <rect x="312" y="144" width="14" height="72" rx="3" fill="#0a0c14" />
      <rect x="314" y="160" width="10" height="54" rx="2" fill={`url(#${id}vu)`} />
      {[[366, 158], [398, 158], [366, 194], [398, 194]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill="#cfd6e6" />)}
    </svg>
  );
}

/** Small guitar silhouettes for choosing your instrument (decorative; the label names it). */
export function GuitarIcon({ kind }: { kind: 'acoustic' | 'electric' | 'classical' }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={kind === 'electric' ? '#ff7a2f' : kind === 'classical' ? '#f0c58a' : '#e9b77a'} />
          <stop offset="1" stopColor={kind === 'electric' ? '#e3266f' : kind === 'classical' ? '#c98a4b' : '#b0692f'} />
        </linearGradient>
      </defs>
      <g transform="rotate(-35 32 32)">
        <rect x="29" y="2" width="6" height="30" rx="1.5" fill="#5a3a22" />
        <rect x={kind === 'classical' ? 26 : 27} y="0" width={kind === 'classical' ? 12 : 10} height="8" rx="2" fill="#3a2414" />
        {kind === 'electric' ? (
          <path d="M22 30c-6 2-8 8-6 13 1 4-2 6-1 10 2 6 11 9 17 9s15-3 17-9c1-4-2-6-1-10 2-5 0-11-6-13-3-1-4 4-7 4h-6c-3 0-4-5-7-4z" fill={`url(#${id}b)`} stroke="#1b1320" strokeWidth="2" />
        ) : (
          <path d="M32 26c-6 0-10 3-10 8 0 3 2 4 2 6-4 2-7 6-7 11 0 7 7 11 15 11s15-4 15-11c0-5-3-9-7-11 0-2 2-3 2-6 0-5-4-8-10-8z" fill={`url(#${id}b)`} stroke="#1b1320" strokeWidth="2" />
        )}
        {kind === 'electric' ? (
          <g fill="#1b1320"><rect x="27" y="40" width="10" height="4" rx="1" /><rect x="27" y="47" width="10" height="4" rx="1" /></g>
        ) : (
          <circle cx="32" cy="42" r="4.5" fill="#1b1320" stroke={kind === 'classical' ? '#7a4a24' : 'none'} strokeWidth="2" />
        )}
        <rect x="27" y="54" width="10" height="3" rx="1" fill="#1b1320" />
      </g>
    </svg>
  );
}
