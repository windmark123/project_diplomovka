/**
 * Poloha variantov v rovine riziko – výnos.
 *
 * Os x nesie anualizovanú volatilitu, os y očakávaný výnos po poplatkoch.
 * Body ležiace vyššie a viac vľavo sú efektívnejšie.
 *
 * Dve rozhodnutia o kreslení, ktoré si vyžadujú vysvetlenie:
 *
 *   • Osi nezačínajú nulou. Varianty toho istého profilu sa líšia desatinami
 *     percentuálneho bodu, takže pri nulovej základni by splynuli do jedného
 *     bodu. Bodový graf kóduje polohu, nie dĺžku, takže orezanie osi tu nie je
 *     skreslením — popiska grafu na to však musí upozorniť.
 *
 *   • Identitu nesie priamy popisok, nie farba. Tri varianty sú tri podoby
 *     toho istého portfólia; rozlíšiť ich troma odtieňmi by zbytočne minulo
 *     kategoriálnu paletu a pri farbosleposti by zlyhalo. Zvolený variant je
 *     odlíšený plnou výplňou, ostatné prstencom.
 */

import { useMemo } from 'react';

import { pct, ratio } from '@/engine/format';
import {
  ChartFrame,
  niceRange,
  scaleLinear,
  useChartWidth,
} from './primitives';

export interface ScatterPoint {
  id: string;
  label: string;
  /** Anualizovaná volatilita. */
  risk: number;
  /** Očakávaný výnos po poplatkoch. */
  ret: number;
  sharpe: number;
  /** Zvolený variant sa kreslí plný, ostatné prstencom. */
  emphasis?: boolean;
}

interface Props {
  points: ScatterPoint[];
  height?: number;
  caption?: React.ReactNode;
}

const MARGIN = { top: 24, right: 28, bottom: 52, left: 62 };

export function RiskReturnScatter({ points, height = 340, caption }: Props) {
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const innerW = Math.max(120, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(120, height - MARGIN.top - MARGIN.bottom);

  const riskAxis = useMemo(
    () => niceRange(Math.min(...points.map((p) => p.risk)), Math.max(...points.map((p) => p.risk)), 4),
    [points],
  );
  const retAxis = useMemo(
    () => niceRange(Math.min(...points.map((p) => p.ret)), Math.max(...points.map((p) => p.ret)), 4),
    [points],
  );

  const x = scaleLinear(riskAxis.lo, riskAxis.hi, MARGIN.left, MARGIN.left + innerW);
  const y = scaleLinear(retAxis.lo, retAxis.hi, MARGIN.top + innerH, MARGIN.top);

  /**
   * Popisky sa kladú vedľa bodu s vodiacou čiarkou. Pri prekrytí sa neposúvajú
   * zvisle — odtrhnutý popisok čitateľ nepriradí k správnemu bodu. Namiesto
   * toho sa preklopí na opačnú stranu bodu.
   */
  const placed = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.risk - b.risk);
    return sorted.map((p, i) => {
      const px = x(p.risk);
      // Bod v pravej tretine plochy dostane popisok vľavo, aby sa nezrezal.
      const right = px < MARGIN.left + innerW * 0.62;
      // Pri zhluku sa susedné popisky striedavo posunú nad a pod bod.
      const above = i % 2 === 0;
      return { ...p, px, py: y(p.ret), right, above };
    });
  }, [points, x, y, innerW]);

  return (
    <ChartFrame innerRef={ref} caption={caption}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Riziko a výnos: ${points
          .map((p) => `${p.label}, volatilita ${pct(p.risk)}, výnos ${pct(p.ret)}, Sharpe ${ratio(p.sharpe)}`)
          .join('; ')}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Mriežka */}
        <g aria-hidden="true">
          {retAxis.ticks.map((t) => (
            <g key={`y${t}`}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + innerW}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--c-grid)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={MARGIN.left - 10}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--c-axis)"
                style={{ font: '400 11px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                {pct(t, 1)}
              </text>
            </g>
          ))}
          {riskAxis.ticks.map((t) => (
            <text
              key={`x${t}`}
              x={x(t)}
              y={MARGIN.top + innerH + 18}
              textAnchor="middle"
              fill="var(--c-axis)"
              style={{ font: '400 11px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
            >
              {pct(t, 1)}
            </text>
          ))}
        </g>

        <text
          x={MARGIN.left + innerW / 2}
          y={height - 6}
          textAnchor="middle"
          fill="var(--text-muted)"
          style={{ font: '400 11px var(--font-mono)', letterSpacing: '0.1em' }}
        >
          VOLATILITA P. A.
        </text>
        <text
          transform={`translate(13, ${MARGIN.top + innerH / 2}) rotate(-90)`}
          textAnchor="middle"
          fill="var(--text-muted)"
          style={{ font: '400 11px var(--font-mono)', letterSpacing: '0.1em' }}
        >
          VÝNOS P. A.
        </text>

        {placed.map((p) => {
          const dx = p.right ? 1 : -1;
          const dy = p.above ? -1 : 1;
          const leadX = p.px + dx * 13;
          const leadY = p.py + dy * 13;
          const textX = leadX + dx * 5;
          return (
            <g key={p.id}>
              {/* Vodiaca čiarka drží popisok pripojený k svojmu bodu. */}
              <line
                x1={p.px + dx * 7}
                y1={p.py + dy * 7}
                x2={leadX}
                y2={leadY}
                stroke="var(--c-axis)"
                strokeWidth={1}
                opacity={0.55}
              />
              <circle cx={p.px} cy={p.py} r={9} fill="var(--surface-card)" />
              <circle
                cx={p.px}
                cy={p.py}
                r={p.emphasis ? 6.5 : 5}
                fill={p.emphasis ? 'var(--c-own)' : 'var(--surface-card)'}
                stroke="var(--c-own)"
                strokeWidth={2}
              />
              <text
                x={textX}
                y={leadY + (p.above ? -2 : 10)}
                textAnchor={p.right ? 'start' : 'end'}
                fill="var(--text-strong)"
                style={{ font: `${p.emphasis ? 600 : 500} 11.5px var(--font-body)` }}
              >
                {p.label}
              </text>
              <text
                x={textX}
                y={leadY + (p.above ? 11 : 23)}
                textAnchor={p.right ? 'start' : 'end'}
                fill="var(--text-muted)"
                style={{ font: '400 10.5px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                Sharpe {ratio(p.sharpe)}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
