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
  const W = 560, H = 200, left = 80, right = 20, top = 22, gap = 28;
  const fretW = (W - left - right) / frets;
  const xOfFret = (f: number) => (leftHanded ? W - right - f * fretW : left + f * fretW);
  const nutX = xOfFret(0);
  const strings: StringNumber[] = [1, 2, 3, 4, 5, 6];
  const dot = diagram.dot;
  const desc =
    `${diagram.caption} Diagram reads like tablature: string 1 (high E, thinnest) at the top, string 6 (low E, thickest) at the bottom` +
    `${leftHanded ? '; mirrored for left-handed players, nut on the right' : '; nut on the left'}.`;
  return (
    <figure className="fret-diagram" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc}>
        <rect x={0} y={0} width={W} height={H} fill="var(--panel)" />
        {Array.from({ length: frets + 1 }, (_, f) => (
          <g key={f}>
            <line x1={xOfFret(f)} x2={xOfFret(f)} y1={top - 6} y2={top + gap * 5 + 6} stroke="var(--ink)" strokeWidth={f === 0 ? 6 : 2} />
            {f > 0 && (
              <text x={(xOfFret(f) + xOfFret(f - 1)) / 2} y={H - 8} textAnchor="middle" fontSize="13" fill="var(--muted)">fret {f}</text>
            )}
          </g>
        ))}
        {strings.map((s, i) => {
          const y = top + i * gap;
          const hi = diagram.highlight.includes(s);
          return (
            <g key={s}>
              <line x1={Math.min(nutX, xOfFret(frets))} x2={Math.max(nutX, xOfFret(frets))} y1={y} y2={y} stroke={hi ? 'var(--accent)' : 'var(--muted)'} strokeWidth={hi ? 4 : 1 + i * 0.5} />
              <text x={leftHanded ? W - 6 : 6} y={y + 5} fontSize="13" textAnchor={leftHanded ? 'end' : 'start'} fill={hi ? 'var(--accent)' : 'var(--ink)'} fontWeight={hi ? 700 : 400}>
                {s} {STRING_LABELS[s].name}
              </text>
            </g>
          );
        })}
        {dot && (
          <g>
            {/* Fingertip just behind the fret wire (toward the nut). */}
            <circle cx={xOfFret(dot.fret) + (leftHanded ? 1 : -1) * fretW * 0.28} cy={top + (dot.string - 1) * gap} r={12} fill="var(--accent)" stroke="var(--ink)" />
            <text x={xOfFret(dot.fret) + (leftHanded ? 1 : -1) * fretW * 0.28} y={top + (dot.string - 1) * gap + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--accent-ink)">
              {dot.finger ?? '•'}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="small muted">
        {diagram.caption} {dot?.finger ? `Number in the dot = suggested finger (1 index, 2 middle, 3 ring, 4 little).` : ''} Read like tab: string 1 on top.
        {leftHanded ? ' Mirrored for left-handed playing.' : ''}
      </figcaption>
    </figure>
  );
}
