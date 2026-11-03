/**
 * Prevent the app from playing itself (master spec §5.4). While the microphone is
 * assessing, the synthesized guide is only audible through headphones. On
 * speakers (or an unknown route) the guide is muted for assessed modes, and the
 * metronome uses aperiodic clicks that carry no pitch evidence.
 */
import type { OutputRoute } from '../storage/types';

export interface GuideDecision {
  guideAudible: boolean;
  mutedForLeakage: boolean;
  notice: string | null;
}

export function guidePolicy(opts: { guideOn: boolean; route: OutputRoute; assessing: boolean }): GuideDecision {
  if (!opts.guideOn) return { guideAudible: false, mutedForLeakage: false, notice: null };
  if (!opts.assessing || opts.route === 'headphones') return { guideAudible: true, mutedForLeakage: false, notice: null };
  return {
    guideAudible: false,
    mutedForLeakage: true,
    notice:
      opts.route === 'speakers'
        ? 'Guide notes are muted while listening: on speakers the microphone would hear them. Use headphones to hear the guide while being assessed, or use Listen mode.'
        : 'Guide notes are muted while listening because the output route is unknown. If you wear headphones, choose “Headphones” in Setup.',
  };
}

/**
 * A backing recording on speakers would reach the microphone (and may contain
 * guitar). While assessing on speakers/unknown, it plays but its spans are not
 * assessed; on headphones it is fine.
 */
export function backingPolicy(opts: { backingOn: boolean; route: OutputRoute; assessing: boolean }): { audible: boolean; blocksAssessment: boolean; notice: string | null } {
  if (!opts.backingOn) return { audible: false, blocksAssessment: false, notice: null };
  if (!opts.assessing || opts.route === 'headphones') return { audible: true, blocksAssessment: false, notice: null };
  return {
    audible: true,
    blocksAssessment: true,
    notice: 'The backing track is playing through speakers, so the mic would hear it too. Notes are not checked while it plays. Wear headphones (and tell the app) to get feedback with the backing.',
  };
}
