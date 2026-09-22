/**
 * Rozpätie výsledkov Monte Carlo simulácie.
 *
 * Graf zámerne nezobrazuje jednotlivé cesty ani priemer, ale percentilové
 * pásma. Priemer by bol zavádzajúci: rozdelenie konečnej hodnoty je pravostranne
 * zošikmené, takže priemer leží nad mediánom a väčšina simulovaných scenárov
 * ho nedosiahne.
 */

import { useMemo } from 'react';

import { eurShort, eurSign } from '@/engine/format';
import type { PercentileBand } from '@/engine/montecarlo';
import {
  AxisX,
  ChartFrame,
  DEFAULT_MARGIN,
  Dot,
  GridY,
  Tooltip,
  areaPath,
  linePath,
  niceTicks,
  scaleLinear,
  useChartWidth,
  useNearestIndex,
} from './primitives';

interface Props {
  bands: PercentileBand[];
  height?: number;
  caption?: React.ReactNode;
  color?: string;
}

export function FanChart({ bands, height = 320, caption, color = 'var(--c-own)' }: Props) {
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const m = { ...DEFAULT_MARGIN, right: 20 };
  const innerW = Math.max(80, width - m.left - m.right);
  const innerH = Math.max(80, height - m.top - m.bottom);

  const years = bands.length - 1;
  const max = useMemo(() => Math.max(1, ...bands.map((b) => b.p95)), [bands]);
  const ticks = useMemo(() => niceTicks(max, 4), [max]);
  const axisMax = ticks[ticks.length - 1];

  const x = scaleLinear(0, years, m.left, m.left + innerW);
  const y = scaleLinear(0, axisMax, m.top + innerH, m.top);

  const domain = useMemo(() => bands.map((b) => b.year), [bands]);
  const [hover, onMove, onLeave] = useNearestIndex(x, domain);

  const pt = (key: keyof PercentileBand) =>
    bands.map((b) => ({ x: x(b.year), y: y(b[key] as number) }));

  const xTicks = useMemo(() => {
    const step = years <= 10 ? 2 : years <= 25 ? 5 : 10;
    const out: number[] = [];
    for (let v = 0; v <= years; v += step) out.push(v);
    if (out[out.length - 1] !== years) out.push(years);
    return out;
  }, [years]);

  const b = hover === null ? null : bands[hover];

  return (
    <ChartFrame
      innerRef={ref}
      legend={[
        { label: 'Medián (50 %)', color },
        { label: 'Stredná polovica scenárov (25.–75. percentil)', color: 'var(--c-band-inner)', shape: 'swatch' },
        { label: 'Deväť z desiatich scenárov (5.–95. percentil)', color: 'var(--c-band)', shape: 'swatch' },
        { label: 'Vložená suma', color: 'var(--c-invested)', dashed: true },
      ]}
      caption={caption}
    >
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Rozpätie hodnoty portfólia počas ${years} rokov: medián a percentilové pásma`}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <GridY ticks={ticks} y={y} x0={m.left} x1={m.left + innerW} format={eurShort} />
        <AxisX ticks={xTicks} x={x} y={m.top + innerH} format={(v) => String(v)} />

        <path d={areaPath(pt('p95'), pt('p5'))} fill="var(--c-band)" />
        <path d={areaPath(pt('p75'), pt('p25'))} fill="var(--c-band-inner)" />

        <path
          d={linePath(pt('invested'))}
          fill="none"
          stroke="var(--c-invested)"
          strokeWidth={2}
          strokeDasharray="5 5"
          strokeLinecap="round"
        />
        <path
          d={linePath(pt('p50'))}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hover !== null && b && (
          <>
            <line
              x1={x(b.year)}
              x2={x(b.year)}
              y1={m.top}
              y2={m.top + innerH}
              stroke="var(--c-axis)"
              strokeWidth={1}
              opacity={0.45}
            />
            <Dot cx={x(b.year)} cy={y(b.p50)} color={color} />
          </>
        )}
      </svg>
      <Tooltip
        state={
          b === null
            ? null
            : {
                x: x(b.year),
                y: m.top + 8,
                title: b.year === 0 ? 'Začiatok sporenia' : `Rok ${b.year}`,
                rows: [
                  { label: '95. percentil', value: eurSign(b.p95) },
                  { label: '75. percentil', value: eurSign(b.p75) },
                  { label: 'Medián', value: eurSign(b.p50), color },
                  { label: '25. percentil', value: eurSign(b.p25) },
                  { label: '5. percentil', value: eurSign(b.p5) },
                  { label: 'Vložené', value: eurSign(b.invested), color: 'var(--c-invested)' },
                ],
              }
        }
        width={width}
      />
    </ChartFrame>
  );
}
