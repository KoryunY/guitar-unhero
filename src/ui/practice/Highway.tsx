import { useEffect, useRef } from 'react';
import { engine } from '../../audio/engine';
import type { PracticeController } from './controller';
import { STRING_LABELS } from '../../domain/tuning';
import type { StringNumber } from '../../domain/score';
import type { AssessmentState } from '../../assessment/types';

const GLYPH: Record<AssessmentState, string> = { correct: '✓', incorrect: '✗', uncertain: '?', not_assessed: '–' };

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

/**
 * Six horizontal string lanes (string 1 on top), time moving toward the hit line.
 * Positions come from the transport at the audible context time — never from
 * frame counting. Left-handed display mirrors direction, not string numbers.
 * Reduced motion: positions advance in whole-beat steps.
 */
export function Highway({ controller, leftHanded, reducedMotion, lookaheadSec, cueLevel = 'full' }: { controller: PracticeController; leftHanded: boolean; reducedMotion: boolean; lookaheadSec: number; cueLevel?: 'full' | 'reduced' | 'none' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      const g = canvas.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = controller.transport;
      const c = engine.ctx ? engine.audibleNow() : 0;
      let pos = t.positionAt(c);
      if (reducedMotion) pos = Math.floor(pos / t.beatSec + 1e-6) * t.beatSec;

      const colors = { lane: css('--lane'), alt: css('--lane-alt'), ink: css('--ink'), muted: css('--muted'), accent: css('--accent'), accentInk: css('--accent-ink'), good: css('--good'), bad: css('--bad'), unsure: css('--unsure'), na: css('--na'), line: css('--line') };
      const labelW = 74;
      const top = 26;
      const laneH = (H - top - 8) / 6;
      const playL = leftHanded ? 0 : labelW;
      const playR = leftHanded ? W - labelW : W;
      const playW = playR - playL;
      const hitFrac = 0.16;
      const hitX = leftHanded ? playR - playW * hitFrac : playL + playW * hitFrac;
      const pps = (playW * (1 - hitFrac)) / Math.max(0.5, lookaheadSec * t.rate); // pixels per source second
      const xOf = (s: number) => (leftHanded ? hitX - (s - pos) * pps : hitX + (s - pos) * pps);

      g.clearRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? colors.alt : colors.lane;
        g.fillRect(0, top + i * laneH, W, laneH);
      }
      // Beat / bar lines.
      const firstBeat = Math.floor((pos - (hitFrac * playW) / pps) / t.beatSec) - 1;
      const lastBeat = Math.ceil((pos + lookaheadSec * t.rate) / t.beatSec) + 1;
      for (let k = Math.max(0, firstBeat); k <= lastBeat; k++) {
        const s = k * t.beatSec;
        if (s > t.durationSec + 1e-9) break;
        const x = xOf(s);
        if (x < playL || x > playR) continue;
        g.strokeStyle = colors.line;
        g.lineWidth = k % 4 === 0 ? 2 : 1;
        g.beginPath();
        g.moveTo(x, top);
        g.lineTo(x, H - 8);
        g.stroke();
        if (k % 4 === 0) {
          g.fillStyle = colors.muted;
          g.font = '11px system-ui';
          g.textAlign = 'center';
          g.fillText(`bar ${k / 4 + 1}`, x, top - 8);
        }
      }
      // Loop region.
      if (t.loop) {
        const a = xOf(t.tickToSec(t.loop.aTick));
        const b = xOf(t.tickToSec(t.loop.bTick));
        g.fillStyle = colors.accent + '22';
        g.fillRect(Math.min(a, b), top, Math.abs(b - a), H - top - 8);
      }
      // Lane labels.
      g.font = 'bold 13px system-ui';
      for (let i = 0; i < 6; i++) {
        const s = (i + 1) as StringNumber;
        g.fillStyle = colors.ink;
        g.textAlign = leftHanded ? 'right' : 'left';
        const lx = leftHanded ? W - 6 : 6;
        g.fillText(`${s}  ${STRING_LABELS[s].name}`, lx, top + i * laneH + laneH / 2 + 4);
        g.strokeStyle = colors.muted;
        g.lineWidth = 1 + i * 0.4;
        g.beginPath();
        g.moveTo(playL, top + i * laneH + laneH / 2);
        g.lineTo(playR, top + i * laneH + laneH / 2);
        g.stroke();
      }
      // Hit line.
      g.strokeStyle = colors.ink;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(hitX, top - 2);
      g.lineTo(hitX, H - 6);
      g.stroke();

      // Notes.
      const waiting = t.state === 'waitingForTarget' ? t.waitingTarget : null;
      const iter = t.loopIteration;
      const r = Math.min(laneH * 0.42, 18);
      for (const ev of t.events) {
        const s = t.eventSec(ev);
        // From memory: upcoming notes are hidden; judged notes are shown after the fact.
        if (cueLevel === 'none' && s > pos - 1e-6 && !controller.judgmentByNote.get(`${t.loopIteration}:${ev.id}`)) continue;
        const x = xOf(s);
        const dur = t.tickToSec(ev.durationTicks) * pps;
        const tailEnd = leftHanded ? x - dur : x + dur;
        if (Math.max(x, tailEnd) < playL - 40 || Math.min(x, tailEnd) > playR + 40) continue;
        const y = top + (ev.string - 1) * laneH + laneH / 2;
        const j = controller.judgmentByNote.get(`${iter}:${ev.id}`);
        const fill = j ? (j.state === 'correct' ? colors.good : j.state === 'incorrect' ? colors.bad : j.state === 'uncertain' ? colors.unsure : colors.na) : colors.accent;
        // Hold/duration tail.
        g.fillStyle = fill + '55';
        g.fillRect(Math.min(x, tailEnd), y - r * 0.35, Math.abs(tailEnd - x), r * 0.7);
        // Head: rounded square for notes (shape + text, not colour alone).
        g.fillStyle = fill;
        g.beginPath();
        g.roundRect(x - r, y - r, 2 * r, 2 * r, 6);
        g.fill();
        if (waiting && waiting.id === ev.id) {
          g.strokeStyle = colors.ink;
          g.lineWidth = 4;
          g.stroke();
        }
        g.fillStyle = colors.accentInk;
        g.font = `bold ${Math.round(r * 1.05)}px system-ui`;
        g.textAlign = 'center';
        if (cueLevel === 'full') g.fillText(String(ev.fret), x, y + r * 0.38);
        // Finger number on approach, judgment glyph after.
        g.font = '12px system-ui';
        g.fillStyle = colors.ink;
        if (j) g.fillText(GLYPH[j.state], x, y - r - 3);
        else if (cueLevel === 'full' && ev.finger && s - pos < 2.5 * t.rate && s >= pos) g.fillText(`finger ${ev.finger}`, x, y - r - 3);
      }

      // Count-in overlay.
      const beat = t.countInBeatAt(engine.now);
      if (beat !== null) {
        g.fillStyle = colors.ink;
        g.font = 'bold 64px system-ui';
        g.textAlign = 'center';
        g.fillText(String(beat), (playL + playR) / 2, top + laneH * 3 + 22);
      }
      if (waiting) {
        g.fillStyle = colors.ink;
        g.font = 'bold 15px system-ui';
        g.textAlign = 'center';
        g.fillText(
          cueLevel === 'none' ? 'Waiting: next note from memory' : cueLevel === 'reduced' ? `Waiting: string ${waiting.string}` : `Waiting: string ${waiting.string}, ${waiting.fret === 0 ? 'open' : `fret ${waiting.fret}`}`,
          (playL + playR) / 2,
          16,
        );
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [controller, leftHanded, reducedMotion, lookaheadSec, cueLevel]);

  return (
    <div className="highway-wrap">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${cueLevel === 'none' ? 'From memory: upcoming notes hidden. ' : ''}Practice highway: six string lanes, string 1 (high E) at the top. Notes move ${leftHanded ? 'left-to-right' : 'right-to-left'} toward the hit line; the number in each note is the fret. A text list of the notes follows below.`}
      />
    </div>
  );
}
