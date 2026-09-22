/**
 * Zloženie portfólia ako prstenec s priamymi popiskami.
 *
 * Časti sú oddelené 2 px medzerou vo farbe podkladu, nie obrysom — obrys by
 * pridal atrament, ktorý nenesie dáta. Popisky idú vedľa prstenca v poradí
 * podľa veľkosti, takže čitateľ nemusí priraďovať farby.
 */

import { ASSET_COLOR } from './colors';
import { pctValue } from '@/engine/format';
import type { AssetClassId } from '@/data/assets';

export interface Slice {
  id: AssetClassId;
  label: string;
  short: string;
  value: number;
  fund?: { ticker: string; ter: number };
}

interface Props {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}

/** Bod na kružnici pre daný uhol v stupňoch (0° hore, po smere hodinových ručičiek). */
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arc = (cx: number, cy: number, rOuter: number, rInner: number, from: number, to: number) => {
  const large = to - from > 180 ? 1 : 0;
  const a = polar(cx, cy, rOuter, from);
  const b = polar(cx, cy, rOuter, to);
  const c = polar(cx, cy, rInner, to);
  const d = polar(cx, cy, rInner, from);
  return [
    `M${a.x.toFixed(2)},${a.y.toFixed(2)}`,
    `A${rOuter},${rOuter} 0 ${large} 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`,
    `L${c.x.toFixed(2)},${c.y.toFixed(2)}`,
    `A${rInner},${rInner} 0 ${large} 0 ${d.x.toFixed(2)},${d.y.toFixed(2)}`,
    'Z',
  ].join(' ');
};

export function AllocationRing({
  slices,
  size = 168,
  thickness = 20,
  centerValue,
  centerLabel,
}: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter - thickness;

  // 2 px medzera medzi časťami, vyjadrená v stupňoch na strednom polomere.
  const gapDeg = slices.length > 1 ? (2 / ((rOuter + rInner) / 2)) * (180 / Math.PI) : 0;

  let cursor = 0;

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--s-7)',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`Zloženie portfólia: ${slices
          .map((s) => `${s.label} ${pctValue(s.value)}`)
          .join(', ')}`}
        style={{ flex: 'none' }}
      >
        {slices.map((s) => {
          const sweep = (s.value / total) * 360;
          const from = cursor + gapDeg / 2;
          const to = cursor + sweep - gapDeg / 2;
          cursor += sweep;
          if (to <= from) return null;
          return (
            <path key={s.id} d={arc(cx, cy, rOuter, rInner, from, to)} fill={ASSET_COLOR[s.id]} />
          );
        })}
        {centerValue && (
          <>
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fill="var(--text-strong)"
              style={{
                font: '500 20px var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {centerValue}
            </text>
            {centerLabel && (
              <text
                x={cx}
                y={cy + 14}
                textAnchor="middle"
                fill="var(--text-muted)"
                style={{ font: '400 10px var(--font-mono)', letterSpacing: '0.1em' }}
              >
                {centerLabel}
              </text>
            )}
          </>
        )}
      </svg>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: 'var(--s-3)',
          minWidth: 0,
          flex: '1 1 200px',
        }}
      >
        {slices.map((s) => (
          <li
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '10px minmax(0, 1fr) auto',
              gap: 'var(--s-3)',
              alignItems: 'baseline',
              fontSize: 'var(--fs-micro)',
            }}
          >
            <i
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: ASSET_COLOR[s.id],
                display: 'block',
              }}
            />
            <span style={{ color: 'var(--text-body)', minWidth: 0 }}>
              {s.short}
              {s.fund && (
                <span className="sp-faint" style={{ marginLeft: 6 }}>
                  {s.fund.ticker}
                </span>
              )}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-strong)',
              }}
            >
              {pctValue(s.value, s.value < 10 ? 1 : 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
