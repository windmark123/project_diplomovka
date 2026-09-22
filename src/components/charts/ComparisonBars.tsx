/**
 * Vodorovné porovnanie konečných hodnôt.
 *
 * Stĺpce rastú z jednej základne, sú tenké a majú zaoblený koniec na strane
 * dát. Hodnota stojí na hrote stĺpca, takže sa nečíta z osi.
 */

import { eurSign } from '@/engine/format';

export interface BarRow {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  color: string;
  /** Voliteľná časť stĺpca oddelená ako vložená suma. */
  invested?: number;
  emphasis?: boolean;
}

interface Props {
  rows: BarRow[];
  /** Formátovanie hodnoty na hrote. */
  format?: (v: number) => string;
  caption?: React.ReactNode;
}

export function ComparisonBars({ rows, format = eurSign, caption }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <figure style={{ margin: 0, display: 'grid', gap: 'var(--s-6)' }}>
      <div style={{ display: 'grid', gap: 'var(--s-6)' }}>
        {rows.map((r) => {
          const pct = (r.value / max) * 100;
          const investedPct = r.invested !== undefined ? (r.invested / max) * 100 : null;
          return (
            <div key={r.id} style={{ display: 'grid', gap: 'var(--s-3)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 'var(--s-4)',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--fs-small)',
                    fontWeight: r.emphasis ? 600 : 500,
                    color: 'var(--text-strong)',
                  }}
                >
                  <i
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: r.color,
                      marginRight: 8,
                    }}
                  />
                  {r.label}
                  {r.sublabel && (
                    <span className="hz-faint" style={{ marginLeft: 8, fontWeight: 400 }}>
                      {r.sublabel}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 'var(--fs-small)',
                    fontWeight: 500,
                    color: 'var(--text-strong)',
                  }}
                >
                  {format(r.value)}
                </span>
              </div>
              <div
                style={{ position: 'relative', height: 18 }}
                role="meter"
                aria-valuenow={Math.round(r.value)}
                aria-valuemin={0}
                aria-valuemax={Math.round(max)}
                aria-label={`${r.label}: ${format(r.value)}`}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: `${pct}%`,
                    background: r.color,
                    borderRadius: '2px 4px 4px 2px',
                  }}
                />
                {/* Vložená suma ako tmavší úsek, oddelený 2 px medzerou. */}
                {investedPct !== null && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: `calc(${investedPct}% - 2px)`,
                      background: 'var(--text-strong)',
                      opacity: 0.2,
                      borderRadius: '2px 0 0 2px',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {caption && (
        <figcaption className="hz-micro" style={{ margin: 0 }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
