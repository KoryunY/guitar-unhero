import type { Diagram } from '../../learning/lessons';
import { STRING_LABELS } from '../../domain/tuning';
import type { StringNumber } from '../../domain/score';

/**
 * Tab-oriented fretboard diagram: string 1 (high E) at the top, string 6 at the
 * bottom, frets increasing away from the nut. Left-handed display mirrors the
 * fret direction only; string numbers never change.
 */
export function FretDiagram({ diagram, leftHanded }: { diagram: Diagram; leftHanded: boolean }) {
  const frets = 5;
  // Shapes high up the neck show frets baseFret … baseFret + 4 instead of the nut.
  const base = Math.max(1, diagram.baseFret ?? 1);
  const rel = (fret: number) => (fret === 0 ? 0 : fret - base + 1);
  const W = 560, H = 214, left = 104, right = 18, top = 26, gap = 29;
  const fretW = (W - left - right) / frets;
  // The label margin (and nut) sit on the left for right-handed display, on the right when mirrored.
  const xOfFret = (f: number) => (leftHanded ? W - left - f * fretW : left + f * fretW);
  const nutX = xOfFret(0);
  const strings: StringNumber[] = [1, 2, 3, 4, 5, 6];
  const dot = diagram.dot;
  const dots = [...(diagram.dots ?? []), ...(dot ? [dot] : [])];
  const fingerText = dots.map((d) => `string ${d.string} fret ${d.fret}${d.finger ? ` finger ${d.finger}` : ''}`).join('; ');
  const desc =
    `${diagram.caption}${fingerText ? ` Fingers: ${fingerText}.` : ''} Diagram reads like tablature: string 1 (high E, thinnest) at the top, string 6 (low E, thickest) at the bottom` +
    `${leftHanded ? '; mirrored for left-handed players, nut on the right' : '; nut on the left'}.`;
  const y0 = top, y5 = top + gap * 5;
  const woodX = Math.min(nutX, xOfFret(frets));
  const woodW = Math.abs(xOfFret(frets) - nutX) + 8;
  const fingerColor = (f: number | null) => (f ? ['', '#2563eb', '#16a34a', '#d97706', '#db2777'][f] : 'var(--primary)');
  return (
    <figure className="fret-diagram" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc}>
        <defs>
          <linearGradient id="fd-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b3a26" />
            <stop offset="0.5" stopColor="#4a2e1d" />
            <stop offset="1" stopColor="#3a2416" />
          </linearGradient>
          <linearGradient id="fd-fret" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9aa0a6" />
            <stop offset="0.5" stopColor="#f1f3f4" />
            <stop offset="1" stopColor="#9aa0a6" />
          </linearGradient>
        </defs>
        <rect x={leftHanded ? woodX - 8 : woodX} y={y0 - 12} width={woodW} height={gap * 5 + 24} rx="6" fill="url(#fd-wood)" />
        {[3, 5, 7, 9, 12, 15].filter((f) => f >= base && f <= base + frets - 1).map((f) => (
          <circle key={f} cx={(xOfFret(rel(f)) + xOfFret(rel(f) - 1)) / 2} cy={(y0 + y5) / 2} r="7" fill="#efe6d2" opacity="0.85" />
        ))}
        {Array.from({ length: frets + 1 }, (_, f) => (
          <g key={f}>
            {f === 0 && base === 1 ? (
              <rect x={xOfFret(0) - 5} y={y0 - 12} width="10" height={gap * 5 + 24} rx="2" fill="#f4ecd8" stroke="#bfb39a" />
            ) : (
              <rect x={xOfFret(f) - 2} y={y0 - 12} width="4" height={gap * 5 + 24} fill="url(#fd-fret)" />
            )}
            {f > 0 && (
              <text x={(xOfFret(f) + xOfFret(f - 1)) / 2} y={H - 4} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--muted)">{base + f - 1}{base > 1 && f === 1 ? 'fr' : ''}</text>
            )}
          </g>
        ))}
        {strings.map((s, i) => {
          const y = top + i * gap;
          const hi = diagram.highlight.includes(s);
          const wound = s >= 3;
          return (
            <g key={s}>
              {hi && <line x1={Math.min(nutX, xOfFret(frets))} x2={Math.max(nutX, xOfFret(frets))} y1={y} y2={y} stroke="var(--hot-1)" strokeWidth={10} strokeOpacity="0.45" strokeLinecap="round" />}
              <line x1={Math.min(nutX, xOfFret(frets))} x2={Math.max(nutX, xOfFret(frets))} y1={y} y2={y} stroke={wound ? '#d6b06a' : '#e8eaed'} strokeWidth={1.2 + i * 0.55} />
              <text x={leftHanded ? W - 6 : 6} y={y + 5} fontSize="15" textAnchor={leftHanded ? 'end' : 'start'} fill={hi ? 'var(--primary)' : 'var(--text)'} fontWeight={hi ? 800 : 500}>
                {s} {STRING_LABELS[s].name}
              </text>
            </g>
          );
        })}
        {dots.map((d) => {
          const cx = xOfFret(rel(d.fret)) + (leftHanded ? 1 : -1) * fretW * 0.28; // fingertip just behind the fret wire
          const cy = top + (d.string - 1) * gap;
          return (
            <g key={`${d.string}-${d.fret}`}>
              <circle cx={cx} cy={cy + 1.5} r={13} fill="#000" opacity="0.35" />
              <circle cx={cx} cy={cy} r={13} fill={fingerColor(d.finger)} stroke="#fff" strokeWidth="2" />
              <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">{d.finger ?? '•'}</text>
            </g>
          );
        })}
        {(diagram.markers ?? []).map((m) => (
          <text key={`m${m.string}`} x={nutX + (leftHanded ? 18 : -18)} y={top + (m.string - 1) * gap + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill={m.mark === 'x' ? 'var(--incorrect)' : 'var(--correct)'}>
            {m.mark === 'x' ? '×' : 'o'}
          </text>
        ))}
      </svg>
      <figcaption className="small muted">
        {diagram.caption} {dots.some((d) => d.finger) ? `Number in the dot = suggested finger (1 index, 2 middle, 3 ring, 4 little).` : ''} Read like tab: string 1 on top.
        {leftHanded ? ' Mirrored for left-handed playing.' : ''}
      </figcaption>
    </figure>
  );
}
