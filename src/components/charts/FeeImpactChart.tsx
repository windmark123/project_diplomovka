/**
 * Vplyv nákladovosti na konečnú hodnotu.
 *
 * Jediná séria, preto bez legendy — názov grafu hovorí, čo je vynesené.
 * Zvýraznené sú dva body: nákladovosť navrhnutého portfólia a nákladovosť
 * fondu tretieho piliera, aby bol rozdiel čitateľný bez odčítavania z osi.
 */

import { useMemo } from 'react';

import { eurShort, eurSign, pct } from '@/engine/format';
import {
  AxisX,
  ChartFrame,
  DEFAULT_MARGIN,
  GridY,
  linePath,
  niceTicks,
  scaleLinear,
  useChartWidth,
} from './primitives';

export interface FeePoint {
  fee: number;
  final: number;
}

export interface FeeMarker {
  fee: number;
  label: string;
  color: string;
}

interface Props {
  points: FeePoint[];
  markers?: FeeMarker[];
  height?: number;
  caption?: React.ReactNode;
}

export function FeeImpactChart({ points, markers = [], height = 280, caption }: Props) {
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const m = { ...DEFAULT_MARGIN, left: 58, right: 20, bottom: 40 };
  const innerW = Math.max(80, width - m.left - m.right);
  const innerH = Math.max(80, height - m.top - m.bottom);

  const maxFee = Math.max(...points.map((p) => p.fee));
  const maxFinal = Math.max(...points.map((p) => p.final));
  const ticks = useMemo(() => niceTicks(maxFinal, 4), [maxFinal]);

  const x = scaleLinear(0, maxFee, m.left, m.left + innerW);
  const y = scaleLinear(0, ticks[ticks.length - 1], m.top + innerH, m.top);

  const feeTicks = useMemo(() => {
    const out: number[] = [];
    for (let v = 0; v <= maxFee + 1e-9; v += 0.005) out.push(Number(v.toFixed(4)));
    return out;
  }, [maxFee]);

  const interpolate = (fee: number): number => {
    const sorted = [...points].sort((a, b) => a.fee - b.fee);
    for (let i = 1; i < sorted.length; i++) {
      if (fee <= sorted[i].fee) {
        const a = sorted[i - 1];
        const b = sorted[i];
        const t = b.fee === a.fee ? 0 : (fee - a.fee) / (b.fee - a.fee);
        return a.final + (b.final - a.final) * t;
      }
    }
    return sorted[sorted.length - 1].final;
  };

  return (
    <ChartFrame innerRef={ref} caption={caption}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Konečná hodnota podľa ročnej nákladovosti, od ${pct(0)} po ${pct(maxFee)}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <GridY ticks={ticks} y={y} x0={m.left} x1={m.left + innerW} format={eurShort} />
        <AxisX ticks={feeTicks} x={x} y={m.top + innerH} format={(v) => pct(v, 2)} />

        <text
          x={m.left + innerW / 2}
          y={height - 2}
          textAnchor="middle"
          fill="var(--text-muted)"
          style={{ font: '400 11px var(--font-mono)', letterSpacing: '0.1em' }}
        >
          ROČNÁ NÁKLADOVOSŤ
        </text>

        <path
          d={linePath(points.map((p) => ({ x: x(p.fee), y: y(p.final) })))}
          fill="none"
          stroke="var(--c-own)"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {markers.map((mk) => {
          const value = interpolate(mk.fee);
          const px = x(mk.fee);
          const flip = px > m.left + innerW * 0.6;
          return (
            <g key={mk.label}>
              <line
                x1={px}
                x2={px}
                y1={y(value)}
                y2={m.top + innerH}
                stroke={mk.color}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.7}
              />
              <circle cx={px} cy={y(value)} r={6} fill="var(--surface-card)" />
              <circle cx={px} cy={y(value)} r={4} fill={mk.color} />
              <text
                x={flip ? px - 10 : px + 10}
                y={y(value) - 14}
                textAnchor={flip ? 'end' : 'start'}
                fill="var(--text-body)"
                style={{ font: '500 11px var(--font-body)' }}
              >
                {mk.label}
              </text>
              <text
                x={flip ? px - 10 : px + 10}
                y={y(value) + 1}
                textAnchor={flip ? 'end' : 'start'}
                fill="var(--text-muted)"
                style={{ font: '400 10px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                {eurSign(value)}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
