/**
 * Vývoj hodnoty v čase pre porovnávané cesty.
 *
 * Jedna os y pre všetky série — porovnávajú sa rovnaké veličiny v rovnakej
 * mene, takže druhá os by bola nielen zbytočná, ale zavádzajúca.
 */

import { useMemo } from 'react';

import { eurShort, eurSign } from '@/engine/format';
import {
  AxisX,
  ChartFrame,
  DEFAULT_MARGIN,
  Dot,
  GridY,
  Tooltip,
  linePath,
  niceTicks,
  scaleLinear,
  useChartWidth,
  useNearestIndex,
  type LegendItem,
} from './primitives';

export interface ProjectionSeries {
  id: string;
  label: string;
  color: string;
  /** Hodnoty po rokoch, index 0 = začiatok. */
  values: number[];
  dashed?: boolean;
  /** Séria sa nepočíta do maxima osi (napr. vložená suma). */
  secondary?: boolean;
}

interface Props {
  series: ProjectionSeries[];
  years: number;
  height?: number;
  caption?: React.ReactNode;
  /** Zobraziť hodnotu na konci každého priebehu. */
  endLabels?: boolean;
}

export function ProjectionChart({ series, years, height = 300, caption, endLabels = true }: Props) {
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const m = { ...DEFAULT_MARGIN, right: endLabels ? 76 : 16 };
  const innerW = Math.max(80, width - m.left - m.right);
  const innerH = Math.max(80, height - m.top - m.bottom);

  const max = useMemo(
    () => Math.max(1, ...series.flatMap((s) => s.values)),
    [series],
  );
  const ticks = useMemo(() => niceTicks(max, 4), [max]);
  const axisMax = ticks[ticks.length - 1];

  const x = scaleLinear(0, years, m.left, m.left + innerW);
  const y = scaleLinear(0, axisMax, m.top + innerH, m.top);

  const domain = useMemo(() => Array.from({ length: years + 1 }, (_, i) => i), [years]);
  const [hover, onMove, onLeave] = useNearestIndex(x, domain);

  const xTicks = useMemo(() => {
    const step = years <= 10 ? 2 : years <= 25 ? 5 : 10;
    const out: number[] = [];
    for (let v = 0; v <= years; v += step) out.push(v);
    if (out[out.length - 1] !== years) out.push(years);
    return out;
  }, [years]);

  const legend: LegendItem[] = series.map((s) => ({
    label: s.label,
    color: s.color,
    dashed: s.dashed,
  }));

  const tooltip =
    hover === null
      ? null
      : {
          x: x(hover),
          y: m.top + 8,
          title: hover === 0 ? 'Začiatok sporenia' : `Rok ${hover}`,
          rows: series.map((s) => ({
            label: s.label,
            value: eurSign(s.values[Math.min(hover, s.values.length - 1)] ?? 0),
            color: s.color,
          })),
        };

  return (
    <ChartFrame innerRef={ref} legend={legend} caption={caption}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Vývoj hodnoty počas ${years} rokov pre ${series.map((s) => s.label).join(', ')}`}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <GridY ticks={ticks} y={y} x0={m.left} x1={m.left + innerW} format={eurShort} />
        <AxisX ticks={xTicks} x={x} y={m.top + innerH} format={(v) => String(v)} />

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={m.top}
            y2={m.top + innerH}
            stroke="var(--c-axis)"
            strokeWidth={1}
            opacity={0.45}
          />
        )}

        {series.map((s) => {
          const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
          return (
            <path
              key={s.id}
              d={linePath(pts)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? '5 5' : undefined}
              opacity={s.secondary ? 0.75 : 1}
            />
          );
        })}

        {hover !== null &&
          series.map((s) => (
            <Dot
              key={s.id}
              cx={x(hover)}
              cy={y(s.values[Math.min(hover, s.values.length - 1)] ?? 0)}
              color={s.color}
            />
          ))}

        {/* Priama popiska na konci priebehu — hodnota, ktorú si čitateľ odnesie. */}
        {endLabels &&
          series.map((s) => {
            const last = s.values[s.values.length - 1] ?? 0;
            return (
              <text
                key={s.id}
                x={m.left + innerW + 8}
                y={y(last)}
                dominantBaseline="middle"
                fill="var(--text-body)"
                style={{
                  font: '500 11px var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {eurShort(last)}
              </text>
            );
          })}
      </svg>
      <Tooltip state={tooltip} width={width} />
    </ChartFrame>
  );
}
