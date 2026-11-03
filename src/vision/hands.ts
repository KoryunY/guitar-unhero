/**
 * Optional MediaPipe Hand Landmarker (Apache-2.0), loaded on demand from this
 * app's own origin (WASM in /mediapipe, model in /models). Runs at a limited
 * rate on the main thread for this experiment; frames never leave the device.
 */
import type { HandLandmarker } from '@mediapipe/tasks-vision';

export const HAND_MODEL = { path: './models/hand_landmarker.task', sha256: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1', approxMB: 7.8 };
export const WASM_APPROX_MB = 13.5;

export interface HandObservation {
  producedAtMs: number;
  hands: { landmarks: { x: number; y: number }[]; score: number | null }[];
}

let instance: HandLandmarker | null = null;

export async function loadHands(): Promise<HandLandmarker> {
  if (instance) return instance;
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks('./mediapipe');
  instance = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: HAND_MODEL.path, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  return instance;
}

export function detectHands(lm: HandLandmarker, video: HTMLVideoElement, nowMs: number): HandObservation {
  const r = lm.detectForVideo(video, nowMs);
  return {
    producedAtMs: performance.now(),
    hands: (r.landmarks ?? []).map((pts, i) => ({
      landmarks: pts.map((p) => ({ x: p.x, y: p.y })),
      score: r.handedness?.[i]?.[0]?.score ?? null,
    })),
  };
}

/** MediaPipe landmark 8 is the index fingertip. */
export const INDEX_TIP = 8;
