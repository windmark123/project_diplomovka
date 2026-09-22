/**
 * Export výsledkov do CSV.
 *
 * Výstup je určený na priame vloženie do príloh práce, preto má slovenské
 * záhlavie, desatinnú čiarku a bodkočiarku ako oddeľovač — tak, ako to
 * očakáva tabuľkový procesor v slovenskom prostredí. Prvé riadky nesú
 * vstupné parametre, aby bol súbor samovysvetľujúci aj bez kontextu.
 */

import { ASSET_CLASSES, DATA_VINTAGE, findFund } from '@/data/assets';
import { LEGAL_VINTAGE, MACRO, wageBand } from '@/data/pillars';
import { normalizeAllocation } from '@/engine/portfolio';
import type { Analysis } from '@/state/analysis';
import type { AppState } from '@/state/store';

/** Číslo v slovenskom formáte — desatinná čiarka, bez oddeľovača tisícov. */
const n = (v: number, digits = 2): string => v.toFixed(digits).replace('.', ',');

/** Bezpečné pole CSV: úvodzovky sa zdvojujú, oddeľovač je bodkočiarka. */
const cell = (v: string | number): string => {
  const s = typeof v === 'number' ? n(v) : v;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const row = (...cells: Array<string | number>): string => cells.map(cell).join(';');

export function resultsCsv(state: AppState, a: Analysis): string {
  const lines: string[] = [];
  const alloc = normalizeAllocation(a.allocation);

  lines.push(row('Štvrtý pilier — výstup modelu'));
  lines.push(row('Vygenerované', new Date().toISOString().slice(0, 10)));
  lines.push(row('Parametre tried aktív', `${DATA_VINTAGE.period} (${DATA_VINTAGE.currency})`));
  lines.push(row('Právne parametre overené', LEGAL_VINTAGE.verifiedOn));
  lines.push('');

  lines.push(row('VSTUPY'));
  lines.push(row('Rizikový profil', a.profile.profile.name));
  lines.push(row('Rizikové skóre', n(a.profile.score, 0)));
  lines.push(row('Mesačný vklad (EUR)', n(state.monthly, 0)));
  lines.push(row('Investičný horizont (rokov)', n(state.horizon, 0)));
  lines.push(row('Hrubá mzda (EUR)', n(wageBand(state.wageBandId).gross, 0)));
  lines.push(row('Inflácia p. a.', n(MACRO.inflation.value * 100) + ' %'));
  lines.push(row('Glide path', state.glidepath.enabled ? 'zapnutý' : 'vypnutý'));
  lines.push(row('Zosúladené riziko', state.riskMatched ? 'áno' : 'nie'));
  lines.push(row('Počet scenárov', n(state.paths, 0)));
  lines.push(row('Semienko generátora', n(a.simulation.seed, 0)));
  lines.push('');

  lines.push(row('ZLOŽENIE PORTFÓLIA'));
  lines.push(row('Trieda aktív', 'Váha (%)', 'Fond', 'ISIN', 'TER (%)', 'Volatilita (%)'));
  for (const c of ASSET_CLASSES) {
    const w = alloc[c.id];
    if (w <= 0.05) continue;
    const fund = findFund(c.id, state.funds[c.id]);
    lines.push(
      row(c.name, n(w, 1), fund.ticker, fund.isin, n(fund.ter * 100), n(c.stats.volatility * 100, 1)),
    );
  }
  lines.push('');

  lines.push(row('UKAZOVATELE PORTFÓLIA'));
  lines.push(row('Očakávaný výnos p. a. (%)', n(a.stats.expectedReturn * 100)));
  lines.push(row('Reálny výnos p. a. (%)', n(a.realReturn * 100)));
  lines.push(row('Volatilita p. a. (%)', n(a.stats.volatility * 100)));
  lines.push(row('Volatilita bez diverzifikácie (%)', n(a.stats.undiversifiedVolatility * 100)));
  lines.push(row('Vážený TER (%)', n(a.stats.ter * 100)));
  lines.push(row('Sharpeho pomer', n(a.sharpe)));
  lines.push(row('Sortinov pomer', n(a.simulation.metrics.sortino)));
  lines.push(row('VaR 95 % (1 rok, %)', n(a.var95 * 100)));
  lines.push(row('CVaR 95 % (1 rok, %)', n(a.cvar95 * 100)));
  lines.push(row('Medián max. poklesu (%)', n(a.simulation.drawdown.median * 100)));
  lines.push(row('Najhorší pokles (%)', n(a.simulation.drawdown.worst * 100)));
  lines.push('');

  lines.push(row('SIMULÁCIA — KONEČNÁ HODNOTA (EUR)'));
  lines.push(row('5. percentil', n(a.simulation.terminal.p5, 0)));
  lines.push(row('25. percentil', n(a.simulation.terminal.p25, 0)));
  lines.push(row('Medián', n(a.simulation.terminal.p50, 0)));
  lines.push(row('75. percentil', n(a.simulation.terminal.p75, 0)));
  lines.push(row('95. percentil', n(a.simulation.terminal.p95, 0)));
  lines.push(row('Priemer', n(a.simulation.terminal.mean, 0)));
  lines.push(row('Medián reálne', n(a.simulation.terminal.medianReal, 0)));
  lines.push(row('P(pod vloženou sumou) (%)', n(a.simulation.probBelowInvested * 100)));
  lines.push('');

  lines.push(row('POROVNANIE CIEST'));
  lines.push(
    row(
      'Cesta',
      'Riziková zložka – priemer (%)',
      'Pripísané (EUR)',
      'Hrubá hodnota (EUR)',
      'Poplatky (EUR)',
      'Daň (EUR)',
      'Čistá hodnota (EUR)',
      'Reálna hodnota (EUR)',
      'IRR (%)',
    ),
  );
  for (const r of a.comparison.routes) {
    lines.push(
      row(
        `${r.label} — ${r.detail}`,
        n(r.equityShare * 100, 1),
        n(r.credited, 0),
        n(r.gross, 0),
        n(r.fees, 0),
        n(r.tax, 0),
        n(r.net, 0),
        n(r.netReal, 0),
        n(r.irr * 100),
      ),
    );
  }
  lines.push('');

  lines.push(row('VÝVOJ PO ROKOCH (EUR)'));
  lines.push(
    row(
      'Rok',
      'Vložené',
      'Vlastné portfólio',
      'II. pilier',
      'III. pilier',
      'Simulácia p5',
      'Simulácia medián',
      'Simulácia p95',
    ),
  );
  const { own, pillar2, pillar3 } = a.comparison;
  for (let y = 0; y < own.series.length; y++) {
    const band = a.simulation.bands[y];
    lines.push(
      row(
        n(y, 0),
        n(own.series[y].invested, 0),
        n(own.series[y].value, 0),
        n(pillar2.series[y]?.value ?? 0, 0),
        n(pillar3.series[y]?.value ?? 0, 0),
        n(band?.p5 ?? 0, 0),
        n(band?.p50 ?? 0, 0),
        n(band?.p95 ?? 0, 0),
      ),
    );
  }

  return lines.join('\r\n');
}

/** Stiahne text ako súbor. BOM zaručí, že Excel prečíta diakritiku správne. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
