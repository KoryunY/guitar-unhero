/** Small UI kit shared by every screen. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export function Segmented<T extends string | number>({ value, options, onChange, label, testId }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; testId?: string }) {
  return (
    <div className="segmented" role="group" aria-label={label} data-testid={testId}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} data-testid={testId} />
      <span />
    </label>
  );
}

export function ToggleRow({ title, sub, checked, onChange, testId }: { title: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <div className="listrow" style={{ cursor: 'default' }}>
      <div className="lr-main">
        <div className="lr-title">{title}</div>
        {sub && <div className="lr-sub">{sub}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} testId={testId} />
    </div>
  );
}

export function LinkRow({ href, onClick, icon, title, sub, testId, trailing }: { href?: string; onClick?: () => void; icon?: IconName; title: string; sub?: string; testId?: string; trailing?: ReactNode }) {
  const body = (
    <>
      {icon && <Icon name={icon} />}
      <div className="lr-main">
        <div className="lr-title">{title}</div>
        {sub && <div className="lr-sub">{sub}</div>}
      </div>
      {trailing ?? <Icon name="chevron" size={20} className="muted" />}
    </>
  );
  return href ? (
    <a className="listrow" href={href} data-testid={testId}>
      {body}
    </a>
  ) : (
    <button type="button" className="listrow" onClick={onClick} data-testid={testId}>
      {body}
    </button>
  );
}

export function ProgressRing({ value, size = 64, label }: { value: number; size?: number; label: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 280ms var(--ease)' }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 4} fontWeight="800" fill="var(--text)">{Math.round(v * 100)}%</text>
    </svg>
  );
}

/** Bottom sheet on phones, right drawer on wide screens. Escape closes; focus moves inside. */
export function Sheet({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, [href], input, select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} data-testid={testId}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2 className="t-title">{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

let toastSetter: ((t: string | null) => void) | null = null;
/** Show a short, non-blocking confirmation ("Step saved"). */
export function toast(text: string): void {
  toastSetter?.(text);
}
export function ToastHost() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    toastSetter = setT;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = window.setTimeout(() => setT(null), 2400);
    return () => window.clearTimeout(id);
  }, [t]);
  return t ? (
    <div className="toast" role="status" aria-live="polite">
      {t}
    </div>
  ) : null;
}

export function Callout({ kind = 'info', children, testId }: { kind?: 'info' | 'good' | 'warn' | 'bad' | 'sim'; children: ReactNode; testId?: string }) {
  const icon: IconName = kind === 'good' ? 'check' : kind === 'warn' || kind === 'bad' ? 'warning' : kind === 'sim' ? 'flask' : 'info';
  return (
    <div className={`callout ${kind === 'info' ? '' : kind}`} data-testid={testId}>
      <Icon name={icon} size={20} />
      <div>{children}</div>
    </div>
  );
}

export function TopBar({ title, back, children }: { title: string; back?: () => void; children?: ReactNode }) {
  return (
    <div className="topbar">
      {back && (
        <button type="button" className="iconbtn" onClick={back} aria-label="Back">
          <Icon name="back" />
        </button>
      )}
      <div className="title" role="heading" aria-level={1}>
        {title}
      </div>
      {children}
    </div>
  );
}
