/**
 * Microphone access with honest, recoverable error states (master spec §4.1, AUD-01).
 */
export type MicState = 'off' | 'requesting' | 'on' | 'denied' | 'absent' | 'busy' | 'unsupported' | 'insecure' | 'lost' | 'error';

export interface MicError {
  state: MicState;
  title: string;
  detail: string;
}

export function micSupport(): MicError | null {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return { state: 'insecure', title: 'Microphone needs a secure page', detail: 'Open the app from http://localhost or an https:// address. Browsers block microphones on other insecure pages.' };
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { state: 'unsupported', title: 'This browser cannot share a microphone here', detail: 'Use current desktop Chrome or Edge. You can still continue without listening or use the labeled simulation.' };
  }
  if (typeof AudioWorkletNode === 'undefined') {
    return { state: 'unsupported', title: 'Audio processing is not available', detail: 'This browser lacks AudioWorklet support. Use current desktop Chrome or Edge.' };
  }
  return null;
}

export function classifyMicError(err: unknown): MicError {
  const name = (err as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        state: 'denied',
        title: 'Microphone permission was blocked',
        detail: 'Click the microphone or lock icon in the address bar, allow the microphone for this site, then press “Try again”. You can also continue without listening.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { state: 'absent', title: 'No microphone was found', detail: 'Plug in or enable a microphone (or audio interface), then press “Try again”.' };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        state: 'busy',
        title: 'The microphone is busy or unavailable',
        detail: 'Another app (a call, recorder or DAW) may be using it, or the system blocked it. Close that app or pick another input, then press “Try again”.',
      };
    case 'OverconstrainedError':
      return { state: 'absent', title: 'The selected input is no longer available', detail: 'Choose another input from the list and try again.' };
    case 'SecurityError':
      return { state: 'insecure', title: 'Microphone blocked by browser security', detail: 'Open the app from http://localhost or https://.' };
    default:
      return { state: 'error', title: 'The microphone could not start', detail: `Unexpected error${name ? ` (${name})` : ''}. Try again or choose another input.` };
  }
}

/** Constraints for instrument analysis: mono, no echo cancellation/noise suppression/AGC. */
export function instrumentConstraints(deviceId: string | null): MediaStreamConstraints {
  return {
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      channelCount: { ideal: 1 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  };
}
