import { describe, expect, it } from 'vitest';
import { apply, calibrationHomography, fretPosition, fretRegion, homography, isFresh, BOARD_CORNERS, type Calibration } from '../../src/vision/fretboard';

describe('camera fretboard geometry (M5)', () => {
  it('fret spacing follows the 12th-root rule (fret 5 = 1 by definition)', () => {
    expect(fretPosition(0)).toBe(0);
    expect(fretPosition(5)).toBeCloseTo(1, 12);
    expect(fretPosition(1)).toBeCloseTo((1 - 2 ** (-1 / 12)) / (1 - 2 ** (-5 / 12)), 12);
    for (let n = 1; n < 5; n++) expect(fretPosition(n + 1) - fretPosition(n)).toBeLessThan(fretPosition(n) - fretPosition(n - 1));
  });

  it('a homography maps the four marked corners exactly and is invertible in practice', () => {
    const img = [{ x: 0.1, y: 0.3 }, { x: 0.12, y: 0.7 }, { x: 0.82, y: 0.62 }, { x: 0.8, y: 0.38 }];
    const H = homography(img, BOARD_CORNERS)!;
    img.forEach((p, i) => {
      const b = apply(H, p)!;
      expect(b.x).toBeCloseTo(BOARD_CORNERS[i]!.x, 9);
      expect(b.y).toBeCloseTo(BOARD_CORNERS[i]!.y, 9);
    });
  });

  it('reports only rough fret regions, out-of-area, or not visible — never an exact fret or contact', () => {
    const cal: Calibration = { corners: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }], createdAt: '' };
    const H = calibrationHomography(cal)!;
    const mid1 = (fretPosition(0) + fretPosition(1)) / 2;
    const r = fretRegion(H, { x: mid1, y: 0.5 });
    expect(r.kind).toBe('region');
    expect(r.text).toMatch(/^Roughly/);
    const r3 = fretRegion(H, { x: (fretPosition(2) + fretPosition(3)) / 2, y: 0.5 });
    expect(r3).toMatchObject({ kind: 'region', fretTo: 3 });
    expect(fretRegion(H, { x: 3, y: 0.5 }).kind).toBe('off_board');
    expect(fretRegion(H, null).kind).toBe('not_visible');
  });

  it('rejects degenerate marks and stale evidence', () => {
    expect(calibrationHomography({ corners: [{ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }], createdAt: '' })).toBeNull();
    expect(isFresh(1000, 1200)).toBe(true);
    expect(isFresh(1000, 1300)).toBe(false);
  });
});
