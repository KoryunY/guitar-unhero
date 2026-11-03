import { useEffect, useRef } from 'react';
import { engine } from '../../audio/engine';
import type { PracticeController } from './controller';
import { STRING_LABELS } from '../../domain/tuning';
import type { StringNumber } from '../../domain/score';
import type { AssessmentState } from '../../assessment/types';

const GLYPH: Record<AssessmentState, string> = { correct: '✓', incorrect: '✗', uncertain: '?', not_assessed: '–' };

/** One colour per string (always paired with the fret number and lane, never colour alone). */
const STRING_COLORS = ['#ff7eb0', '#ffc24d', '#5be38f', '#5cc8ff', '#b79cff', '#ff9a52'];

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
    // Sparks for notes judged correct (decorative; never for misses).
    const sparked = new Set<string>();
    let primed = false;
    const sparks: { x: number; y: number; vx: number; vy: number; born: number; hue: string }[] = [];
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

      const colors = { lane: css('--surface-2'), alt: css('--surface-3'), ink: css('--text'), muted: css('--muted'), accent: css('--primary'), accentInk: css('--on-primary'), good: css('--correct'), bad: css('--incorrect'), unsure: css('--uncertain'), na: css('--na'), line: css('--border') };
      const labelW = 46;
      const top = 8;
      const laneH = (H - top - 8) / 6;
      const playL = leftHanded ? 0 : labelW;
      const playR = leftHanded ? W - labelW : W;
      const playW = playR - playL;
      const hitFrac = 0.16;
      const hitX = leftHanded ? playR - playW * hitFrac : playL + playW * hitFrac;
      const pps = (playW * (1 - hitFrac)) / Math.max(0.5, lookaheadSec * t.rate); // pixels per source second
      const xOf = (s: number) => (leftHanded ? hitX - (s - pos) * pps : hitX + (s - pos) * pps);

      g.clearRect(0, 0, W, H);
      // Fretboard-like stage: dark wood with a slight vertical gradient.
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#2a1a12');
      bg.addColorStop(0.5, '#3a2418');
      bg.addColorStop(1, '#22140d');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(leftHanded ? W - labelW : 0, 0, labelW, H);
      const root = document.documentElement.dataset;
      const fx = !reducedMotion && root.effects !== 'off' && root.contrast !== 'high';
      if (root.contrast !== 'high') {
        // Stage lighting: soft side lamps, and a spotlight centred exactly on the hit line.
        for (const f of [0.42, 0.66, 0.9]) {
          const lx = leftHanded ? playR - playW * f : playL + playW * f;
          const cone = g.createLinearGradient(0, 0, 0, H * 0.7);
          cone.addColorStop(0, 'rgba(255,226,196,0.10)');
          cone.addColorStop(1, 'rgba(255,226,196,0)');
          g.fillStyle = cone;
          g.beginPath();
          g.moveTo(lx - 6, 0);
          g.lineTo(lx + 6, 0);
          g.lineTo(lx + playW * 0.08, H * 0.7);
          g.lineTo(lx - playW * 0.08, H * 0.7);
          g.closePath();
          g.fill();
        }
        const spot = g.createLinearGradient(0, 0, 0, H);
        spot.addColorStop(0, 'rgba(255,210,168,0.26)');
        spot.addColorStop(0.6, 'rgba(255,154,92,0.10)');
        spot.addColorStop(1, 'rgba(255,122,47,0.05)');
        g.fillStyle = spot;
        g.beginPath();
        g.moveTo(hitX - 7, 0);
        g.lineTo(hitX + 7, 0);
        g.lineTo(hitX + Math.min(46, playW * 0.05), H);
        g.lineTo(hitX - Math.min(46, playW * 0.05), H);
        g.closePath();
        g.fill();
      }
      // Beat / bar lines.
      // Beat lines follow the tempo map (aligned songs: tick 0 is not at 0 s and tempo drifts).
      const firstBeat = Math.floor(t.secToTick(pos - (hitFrac * playW) / pps) / 960) - 1;
      const lastBeat = Math.ceil(t.secToTick(pos + lookaheadSec * t.rate) / 960) + 1;
      for (let k = Math.max(0, firstBeat); k <= lastBeat; k++) {
        const s = t.tickToSec(k * 960);
        if (s > t.durationSec + 1e-9) break;
        const x = xOf(s);
        if (x < playL || x > playR) continue;
        g.strokeStyle = k % 4 === 0 ? 'rgba(230,230,235,0.75)' : 'rgba(230,230,235,0.22)';
        g.lineWidth = k % 4 === 0 ? 3 : 1;
        g.beginPath();
        g.moveTo(x, top);
        g.lineTo(x, H - 8);
        g.stroke();

      }
      // Loop region.
      if (t.loop) {
        const a = xOf(t.tickToSec(t.loop.aTick));
        const b = xOf(t.tickToSec(t.loop.bTick));
        g.fillStyle = colors.accent + '22';
        g.fillRect(Math.min(a, b), top, Math.abs(b - a), H - top - 8);
      }
      // Lane labels.
      g.font = `bold ${Math.round(Math.min(18, laneH * 0.42))}px system-ui`;
      for (let i = 0; i < 6; i++) {
        const s = (i + 1) as StringNumber;
        g.fillStyle = STRING_COLORS[i]!;
        g.textAlign = leftHanded ? 'right' : 'left';
        const lx = leftHanded ? W - 6 : 6;
        g.fillText(`${s} ${STRING_LABELS[s].name.replace(/\d/, '')}`, lx, top + i * laneH + laneH / 2 + 6);
        g.strokeStyle = i >= 2 ? 'rgba(214,176,106,0.9)' : 'rgba(232,234,237,0.9)';
        g.lineWidth = 1 + i * 0.5;
        g.beginPath();
        g.moveTo(playL, top + i * laneH + laneH / 2);
        g.lineTo(playR, top + i * laneH + laneH / 2);
        g.stroke();
      }
      // Hit line with a glow that swells on each beat while playing (from the audio clock).
      let pulse = 0;
      if (fx && t.state === 'playing') {
        const tick = t.secToTick(pos);
        const frac = (((tick % 960) + 960) % 960) / 960;
        pulse = (1 - frac) ** 3;
        const glow = g.createRadialGradient(hitX, H / 2, 0, hitX, H / 2, Math.max(60, H * 0.45));
        glow.addColorStop(0, `rgba(255,140,80,${0.22 * pulse})`);
        glow.addColorStop(1, 'rgba(255,140,80,0)');
        g.fillStyle = glow;
        g.fillRect(hitX - H, 0, 2 * H, H);
      }
      g.save();
      g.shadowColor = '#ff7a2f';
      g.shadowBlur = 16 + 18 * pulse;
      g.strokeStyle = '#ffb27a';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(hitX, top - 2);
      g.lineTo(hitX, H - 6);
      g.stroke();
      g.restore();

      // Notes.
      const waiting = t.state === 'waitingForTarget' ? t.waitingTarget : null;
      const iter = t.loopIteration;
      const r = Math.min(laneH * 0.44, 24);
      for (const ev of t.events) {
        const s = t.eventSec(ev);
        // From memory: upcoming notes are hidden; judged notes are shown after the fact.
        if (cueLevel === 'none' && s > pos - 1e-6 && !controller.judgmentByNote.get(`${t.loopIteration}:${ev.id}`)) continue;
        const x = xOf(s);
        const dur = (t.tickToSec(ev.startTick + ev.durationTicks) - s) * pps;
        const tailEnd = leftHanded ? x - dur : x + dur;
        if (Math.max(x, tailEnd) < playL - 40 || Math.min(x, tailEnd) > playR + 40) continue;
        const y = top + (ev.string - 1) * laneH + laneH / 2;
        const j = controller.judgmentByNote.get(`${iter}:${ev.id}`);
        const fill = j ? (j.state === 'correct' ? '#4ade80' : j.state === 'incorrect' ? '#ff6b6b' : j.state === 'uncertain' ? '#f5c04a' : '#a3a3b2') : STRING_COLORS[ev.string - 1]!;
        // Hold/duration tail.
        g.fillStyle = fill + '55';
        g.fillRect(Math.min(x, tailEnd), y - r * 0.35, Math.abs(tailEnd - x), r * 0.7);
        // Head: rounded square for notes (shape + text, not colour alone).
        const near = Math.abs(x - hitX) < r * 1.5;
        g.save();
        if (near || (waiting && waiting.id === ev.id)) {
          g.shadowColor = fill;
          g.shadowBlur = 18;
        }
        g.fillStyle = fill;
        g.beginPath();
        g.roundRect(x - r, y - r, 2 * r, 2 * r, 8);
        g.fill();
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,0.55)';
        g.lineWidth = 2;
        g.stroke();
        if (waiting && waiting.id === ev.id) {
          g.strokeStyle = '#ffffff';
          g.lineWidth = 4;
          g.stroke();
        }
        // The fret number (O = open); a dot for "strings only" hints.
        g.fillStyle = '#1b1320';
        g.font = `900 ${Math.round(r * 1.05)}px system-ui`;
        g.textAlign = 'center';
        g.fillText(cueLevel === 'full' ? (ev.fret === 0 ? 'O' : String(ev.fret)) : '•', x, y + r * 0.38);

        // Finger number on approach, judgment glyph after.
        g.font = `bold ${Math.round(r * 0.8)}px system-ui`;
        g.fillStyle = '#ffffff';
        const side = leftHanded ? -1 : 1;
        if (j) g.fillText(GLYPH[j.state], x + side * (r + 12), y + r * 0.3);
      }

      // Sparks where a note was played right.
      if (fx) {
        const now = performance.now();
        for (const ev of t.events) {
          const key = `${iter}:${ev.id}`;
          const j = controller.judgmentByNote.get(key);
          if (!j || j.state !== 'correct' || sparked.has(key)) continue;
          sparked.add(key);
          if (!primed) continue;
          const y = top + (ev.string - 1) * laneH + laneH / 2;
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2 + Math.random() * 0.4;
            const v = 60 + Math.random() * 120;
            sparks.push({ x: hitX, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, born: now, hue: k % 3 === 0 ? '#4ade80' : k % 3 === 1 ? '#ffcb47' : '#ffb27a' });
          }
        }
        primed = true;
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (let k = sparks.length - 1; k >= 0; k--) {
          const sp = sparks[k]!;
          const age = (now - sp.born) / 1000;
          if (age > 0.65) {
            sparks.splice(k, 1);
            continue;
          }
          const life = 1 - age / 0.65;
          g.globalAlpha = life;
          g.fillStyle = sp.hue;
          g.beginPath();
          g.arc(sp.x + sp.vx * age, sp.y + sp.vy * age + 140 * age * age, 1.5 + 2.5 * life, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }

      // Count-in overlay.
      const beat = t.countInBeatAt(engine.now);
      if (beat !== null) {
        g.fillStyle = '#ffffff';
        g.font = `bold ${Math.round(Math.min(96, laneH * 2.4))}px system-ui`;
        g.textAlign = 'center';
        g.globalAlpha = 0.85;
        g.fillText(String(beat), hitX + (leftHanded ? -1 : 1) * Math.min(120, playW * 0.2), top + laneH * 3 + laneH * 0.8);
        g.globalAlpha = 1;
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
