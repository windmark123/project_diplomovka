/** Základné prvky rozhrania postavené na tokenoch dizajnového systému. */

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  KeyboardEventHandler,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

const cx = (...parts: Array<string | false | undefined | null>): string =>
  parts.filter(Boolean).join(' ');

// ───────────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'signal' | 'primary' | 'glass' | 'quiet';
export type ControlSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
}

export function Button({ variant = 'glass', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx('sp-btn', `sp-btn--${variant}`, size !== 'md' && `sp-btn--${size}`, className)}
      {...rest}
    />
  );
}

interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: ControlSize;
  children: ReactNode;
  onClick?: () => void;
}

export function LinkButton({ href, variant = 'glass', size = 'md', children, onClick }: LinkButtonProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cx('sp-btn', `sp-btn--${variant}`, size !== 'md' && `sp-btn--${size}`)}
    >
      {children}
    </a>
  );
}

// ───────────────────────────────────────────────────────────────────────────

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('sp-label', className)}>{children}</span>;
}

export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('sp-num', className)}>{children}</span>;
}

export function Badge({
  children,
  tone = 'quiet',
}: {
  children: ReactNode;
  tone?: 'pos' | 'warn' | 'neg' | 'info' | 'signal' | 'quiet';
}) {
  return <span className={`sp-badge sp-badge--${tone}`}>{children}</span>;
}

export function Note({
  children,
  tone = 'info',
  className,
  style,
}: {
  children: ReactNode;
  tone?: 'warn' | 'info' | 'signal';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cx('sp-note', `sp-note--${tone}`, className)} style={style}>
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

interface PanelProps {
  label?: ReactNode;
  title?: ReactNode;
  footnote?: ReactNode;
  children?: ReactNode;
  className?: string;
  span?: 1 | 2 | 3 | 4;
  /** Vnútorné odsadenie; vypni pri obsahu, ktorý má siahať po okraj. */
  padded?: boolean;
  id?: string;
  style?: CSSProperties;
  /** Panel, ktorý je sám ovládacím prvkom (napr. voľba variantu). */
  onClick?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  role?: string;
  tabIndex?: number;
  ariaPressed?: boolean;
}

export function Panel({
  label,
  title,
  footnote,
  children,
  className,
  span,
  padded = true,
  id,
  style,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  ariaPressed,
}: PanelProps) {
  return (
    <section
      id={id}
      style={style}
      className={cx('sp-panel', padded && 'sp-panel--pad', span && span > 1 && `span-${span}`, className)}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role}
      tabIndex={tabIndex}
      aria-pressed={ariaPressed}
    >
      {(label || title) && (
        <header style={{ display: 'grid', gap: 'var(--s-3)', marginBottom: 'var(--s-6)' }}>
          {label && <Label>{label}</Label>}
          {title && <h3 className="sp-subhead" style={{ margin: 0 }}>{title}</h3>}
        </header>
      )}
      {children}
      {footnote && (
        <p className="sp-micro" style={{ margin: 'var(--s-6) 0 0' }}>
          {footnote}
        </p>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: ReactNode;
  value?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, value, hint, children, htmlFor }: FieldProps) {
  return (
    <div className="sp-field">
      <div className="sp-field__top">
        <label className="sp-field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {value !== undefined && <output className="sp-field__value">{value}</output>}
      </div>
      {children}
      {hint && <p className="sp-field__hint" style={{ margin: 0 }}>{hint}</p>}
    </div>
  );
}

interface RangeProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  min: number;
  max: number;
  value: number;
  onValueChange: (v: number) => void;
}

export function Range({ min, max, value, onValueChange, style, ...rest }: RangeProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className="sp-range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      style={{ ['--fill' as string]: `${fill}%`, ...style }}
      {...rest}
    />
  );
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  onValueChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}

export function Select({ options, onValueChange, className, ...rest }: SelectProps) {
  return (
    <select
      className={cx('sp-select', className)}
      onChange={(e) => onValueChange(e.target.value)}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="sp-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel: string;
}

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div className="sp-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onValueChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

export function Kpi({
  value,
  unit,
  label,
  description,
  tone,
}: {
  value: ReactNode;
  unit?: string;
  label: ReactNode;
  description?: ReactNode;
  tone?: 'pos' | 'neg' | 'signal';
}) {
  const color =
    tone === 'pos' ? 'var(--pos-1)' : tone === 'neg' ? 'var(--neg-1)' : tone === 'signal' ? 'var(--text-accent)' : undefined;
  return (
    <div className="sp-kpi">
      <Label>{label}</Label>
      <span className="sp-kpi__v" style={color ? { color } : undefined}>
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {description && <p>{description}</p>}
    </div>
  );
}

export function Meter({
  label,
  value,
  display,
}: {
  label: ReactNode;
  /** Podiel 0–1. */
  value: number;
  display?: ReactNode;
}) {
  const pctWidth = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
  return (
    <div className="sp-meter">
      <div className="sp-meter__top">
        <span>{label}</span>
        <Num>{display ?? pctWidth}</Num>
      </div>
      <div
        className="sp-meter__bar"
        role="meter"
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <b style={{ width: pctWidth }} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

interface StepIndicatorProps {
  steps: string[];
  current: number;
  completed: boolean[];
  onSelect: (index: number) => void;
}

export function StepIndicator({ steps, current, completed, onSelect }: StepIndicatorProps) {
  return (
    <nav className="sp-steps" aria-label="Kroky nástroja">
      {steps.map((s, i) => (
        <button
          key={s}
          type="button"
          className={completed[i] ? 'is-done' : undefined}
          aria-current={i === current ? 'step' : undefined}
          onClick={() => onSelect(i)}
        >
          <i aria-hidden="true">{completed[i] ? '✓' : i + 1}</i>
          {s}
        </button>
      ))}
    </nav>
  );
}

// ───────────────────────────────────────────────────────────────────────────

export function SectionHead({
  label,
  title,
  lead,
  actions,
}: {
  label?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="sp-split" style={{ marginBottom: 'var(--s-10)' }}>
      <div>
        {label && <Label>{label}</Label>}
        <h2 className="sp-title" style={{ margin: label ? 'var(--s-5) 0 0' : 0, maxWidth: '22ch' }}>
          {title}
        </h2>
      </div>
      <div className="sp-stack">
        {lead && <p className="sp-prose" style={{ margin: 0, lineHeight: 'var(--lh-body)' }}>{lead}</p>}
        {actions && <div className="sp-row">{actions}</div>}
      </div>
    </div>
  );
}
