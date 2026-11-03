/** Original inline SVG icons on a 24-px grid, 2-px round strokes, currentColor. */
import type { SVGProps } from 'react';

const P: Record<string, string> = {
  today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  learn: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z',
  practice: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  tune: 'M4 18a8 8 0 1 1 16 0M12 18l4-6M12 6v2M6.3 8.3l1.4 1.4M17.7 8.3l-1.4 1.4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  restart: 'M5 5v14M19 5L9 12l10 7z',
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  back: 'M19 12H5M11 18l-6-6 6-6',
  close: 'M18 6L6 18M6 6l12 12',
  options: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3',
  micOff: 'M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.9-.7M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 10.6 6M12 18v3',
  check: 'M20 6L9 17l-5-5',
  cross: 'M18 6L6 18M6 6l12 12',
  question: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  minus: 'M5 12h14',
  volume: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  volumeOff: 'M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6',
  plus: 'M12 5v14M5 12h14',
  headphones: 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z',
  speaker: 'M6 3h12v18H6zM12 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 7h.01',
  camera: 'M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  chevron: 'M9 18l6-6-6-6',
  warning: 'M12 3l10 18H2zM12 10v4M12 18h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5M12 8h.01',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  sparkle: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
  flame: 'M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s1 2 2 2c0-4 2-8 2-8z',
  ear: 'M6 9a6 6 0 0 1 12 0c0 3-2 4-3 5s-1 3-3 4-4 0-4-2M9 9a3 3 0 0 1 6 0',
  wave: 'M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h-2',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  flask: 'M9 3h6M10 3v6l-6 10a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3',
  guitar: 'M14 10l6-6M18 2l4 4M10.5 9.5a4.5 4.5 0 0 0-6.4 0c-1.8 1.8-1.5 5 .7 7.2s5.4 2.5 7.2.7a4.5 4.5 0 0 0 0-6.4M9 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-3.5a1.5 1.5 0 0 1 2.6-1.5L8 15',
  crown: 'M3 18h18l-2-10-5 4-2-6-2 6-5-4zM5 21h14',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 24, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const filled = name === 'play' || name === 'pause' || name === 'restart';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={P[name]} />
    </svg>
  );
}
