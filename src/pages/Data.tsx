/**
 * Dáta a zdroje — prehľad všetkých parametrov, s ktorými model pracuje.
 *
 * Stránka existuje preto, aby sa dal ktorýkoľvek výsledok spätne odvodiť.
 * Žiadny parameter nie je v kóde skrytý pred čitateľom.
 */

import {
  ASSET_CLASSES,
  ASSET_CLASS_IDS,
  CORRELATION,
  DATA_VINTAGE,
} from '@/data/assets';
import {
  DDS_PROVIDERS,
  DSS_PROVIDERS,
  LEGAL_VINTAGE,
  MACRO,
  OWN_PORTFOLIO_TAX,
  PILLAR_2,
  PILLAR_3,
  WAGE_BANDS,
  type LegalParam,
} from '@/data/pillars';
import { eurSign, pct, ratio } from '@/engine/format';
import { ASSET_COLOR } from '@/components/charts';
import { Badge, Label, Note, Panel, SectionHead } from '@/components/ui';

const LEGAL_ROWS: Array<LegalParam<number>> = [
  MACRO.inflation,
  MACRO.wageGrowth,
  PILLAR_2.contributionRate,
  PILLAR_2.managementFeeCap,
  PILLAR_2.contributionFee,
  PILLAR_3.taxReliefCap,
  PILLAR_3.incomeTaxRate,
  PILLAR_3.payoutTaxRate,
  OWN_PORTFOLIO_TAX.timeTestYears,
  OWN_PORTFOLIO_TAX.capitalGainsRate,
];

/** Hodnota parametra vo formáte primeranom jeho povahe. */
function formatParam(p: LegalParam<number>): string {
  if (p.label.includes('strop daňovej')) return eurSign(p.value);
  if (p.label.includes('Časový test')) return `${p.value} rok`;
  return pct(p.value, 2);
}

/** Farba pozadia bunky korelačnej matice — jedna škála od nuly po jednotku. */
const correlationTint = (v: number): string => {
  const alpha = Math.min(0.85, Math.max(0, v) * 0.8);
  return `rgba(228, 87, 46, ${alpha.toFixed(3)})`;
};

export function Data() {
  const needsVerification = LEGAL_ROWS.filter((p) => p.verify).length;

  return (
    <div className="hz-page hz-page--app hz-section--tight">
      <section>
        <Label>Dáta a zdroje</Label>
        <h1 className="hz-title" style={{ margin: 'var(--s-5) 0 var(--s-7)', maxWidth: '24ch' }}>
          Každý parameter, s ktorým model počíta
        </h1>
        <p className="hz-lead">
          Parametre tried aktív zodpovedajú obdobiu {DATA_VINTAGE.period} a sú vyjadrené
          v {DATA_VINTAGE.currency}. Právne parametre boli naposledy overené{' '}
          {LEGAL_VINTAGE.verifiedOn}.
        </p>

        {(!DATA_VINTAGE.verifiedAgainstPrimarySource || !LEGAL_VINTAGE.verifiedAgainstZbierka) && (
          <Note tone="warn" style={{ marginTop: 'var(--s-7)', maxWidth: '68ch' }}>
            <strong>Parametre čakajú na overenie voči primárnemu zdroju.</strong> Hodnoty
            nižšie sú východiskovými parametrami modelu, konzistentnými s bežne uvádzanými
            charakteristikami príslušných indexov a s platnou právnou úpravou.{' '}
            {needsVerification} právnych parametrov je označených ako často sa meniace.
            Pred odovzdaním práce ich treba overiť voči Zbierke zákonov a voči zvolenému
            dátovému zdroju a označiť príznaky v súboroch{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>src/data/assets.ts</code> a{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>src/data/pillars.ts</code>.
            Výmena čísel nevyžaduje zásah do výpočtovej logiky.
          </Note>
        )}
      </section>

      {/* ── Triedy aktív ─────────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <SectionHead
          label="Triedy aktív"
          title="Výnos, volatilita a historický pokles"
          lead="Výnosy sú nominálne, pred nákladovosťou fondu. Maximálny historický pokles slúži len ako kontext — do výpočtu nevstupuje."
        />
        <div className="hz-table-wrap">
          <table className="hz-table">
            <thead>
              <tr>
                <th scope="col">Trieda aktív</th>
                <th scope="col" className="num">Výnos p. a.</th>
                <th scope="col" className="num">Volatilita</th>
                <th scope="col" className="num">Max. pokles</th>
                <th scope="col">Charakteristika</th>
              </tr>
            </thead>
            <tbody>
              {ASSET_CLASSES.map((c) => (
                <tr key={c.id}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    <i
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: ASSET_COLOR[c.id],
                        marginRight: 8,
                      }}
                    />
                    {c.name}
                  </th>
                  <td className="num">{pct(c.stats.nominalReturn, 1)}</td>
                  <td className="num">{pct(c.stats.volatility, 1)}</td>
                  <td className="num">{pct(c.stats.historicalMaxDrawdown, 0)}</td>
                  <td style={{ maxWidth: '38ch', fontWeight: 400 }}>{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Fondy ────────────────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <SectionHead
          label="Nástroje"
          title="Konkrétne ETF"
          lead="Všetky fondy sú UCITS s domicilom v EÚ. Nákladovosť a ISIN treba pri finalizácii práce overiť voči aktuálnemu dokumentu s kľúčovými informáciami, pretože sa v čase menia."
        />
        <div className="hz-table-wrap">
          <table className="hz-table">
            <thead>
              <tr>
                <th scope="col">Ticker</th>
                <th scope="col">Názov</th>
                <th scope="col">ISIN</th>
                <th scope="col" className="num">TER</th>
                <th scope="col">Replikácia</th>
                <th scope="col">Typ</th>
                <th scope="col">Index</th>
              </tr>
            </thead>
            <tbody>
              {ASSET_CLASSES.flatMap((c) =>
                c.funds.map((f) => (
                  <tr key={f.isin}>
                    <th scope="row" style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                      {f.ticker}
                    </th>
                    <td style={{ fontWeight: 400 }}>{f.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)' }}>
                      {f.isin}
                    </td>
                    <td className="num">{pct(f.ter, 2)}</td>
                    <td style={{ fontWeight: 400 }}>{f.replication}</td>
                    <td style={{ fontWeight: 400 }}>{f.distribution}</td>
                    <td style={{ fontWeight: 400, fontSize: 'var(--fs-micro)' }}>{f.benchmark}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Korelácie ────────────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <SectionHead
          label="Korelácie"
          title="Matica ročných výnosov"
          lead="Matica vstupuje do výpočtu volatility portfólia a do generovania korelovaných scenárov. Sýtejšia bunka znamená vyššiu koreláciu — a teda menší prínos diverzifikácie."
        />
        <Panel padded>
          <div style={{ overflowX: 'auto' }}>
            <table
              className="hz-table"
              style={{ minWidth: 520, fontFamily: 'var(--font-mono)' }}
            >
              <caption className="hz-sr">Korelačná matica tried aktív</caption>
              <thead>
                <tr>
                  <th scope="col" />
                  {ASSET_CLASS_IDS.map((id) => (
                    <th key={id} scope="col" className="num">
                      {ASSET_CLASSES.find((c) => c.id === id)!.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ASSET_CLASS_IDS.map((i) => (
                  <tr key={i}>
                    <th scope="row" style={{ whiteSpace: 'nowrap' }}>
                      {ASSET_CLASSES.find((c) => c.id === i)!.short}
                    </th>
                    {ASSET_CLASS_IDS.map((j) => (
                      <td
                        key={j}
                        className="num"
                        style={{
                          background: correlationTint(CORRELATION[i][j]),
                          color:
                            CORRELATION[i][j] > 0.55 ? 'var(--white)' : 'var(--text-strong)',
                        }}
                      >
                        {ratio(CORRELATION[i][j])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      {/* ── Právne parametre ─────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <SectionHead
          label="Právne parametre"
          title="Sadzby, stropy a ich zdroj"
          lead="Parametre označené ako „overiť“ sa v poslednej dekáde menili opakovane. Všetky sú editovateľné v nástroji, takže model je použiteľný aj po zmene legislatívy."
        />
        <div className="hz-table-wrap">
          <table className="hz-table">
            <thead>
              <tr>
                <th scope="col">Parameter</th>
                <th scope="col" className="num">Hodnota</th>
                <th scope="col">Prameň</th>
                <th scope="col">Stav</th>
              </tr>
            </thead>
            <tbody>
              {LEGAL_ROWS.map((p) => (
                <tr key={p.label}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    {p.label}
                  </th>
                  <td className="num">{formatParam(p)}</td>
                  <td style={{ fontWeight: 400, fontSize: 'var(--fs-micro)' }}>{p.source}</td>
                  <td>
                    {p.verify ? <Badge tone="warn">overiť</Badge> : <Badge tone="quiet">stabilné</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Správcovia ───────────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <SectionHead
          label="Správcovia"
          title="Odplaty v II. a III. pilieri"
          lead="Odplata za správu je hlavnou príčinou rozdielu medzi vlastným portfóliom a tretím pilierom. Hodnoty treba overiť voči štatútom fondov a výkazom zverejneným na stránke NBS."
        />
        <div className="hz-split" style={{ alignItems: 'start' }}>
          {[
            { title: 'II. pilier — DSS', list: DSS_PROVIDERS },
            { title: 'III. pilier — DDS', list: DDS_PROVIDERS },
          ].map((group) => (
            <Panel key={group.title} padded label={group.title}>
              <div className="hz-stack">
                {group.list.map((p) => (
                  <div
                    key={p.id}
                    className="hz-row hz-row--between"
                    style={{
                      borderBottom: '1px solid var(--border-hair)',
                      paddingBottom: 'var(--s-4)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--fs-small)' }}>{p.company}</span>
                    <span className="hz-num hz-small">{pct(p.managementFee, 2)} p. a.</span>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      </section>

      {/* ── Mzdové pásma ─────────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <SectionHead
          label="Mzdové pásma"
          title="Odhad odvodu do II. piliera"
          lead={`Odvod predstavuje ${pct(
            PILLAR_2.contributionRate.value,
            0,
          )} z hrubej mzdy. Pásma slúžia len na tento odhad a do ničoho iného nevstupujú.`}
        />
        <div className="hz-kpis">
          {WAGE_BANDS.map((b) => (
            <div className="hz-kpi" key={b.id}>
              <Label>{b.label}</Label>
              <span className="hz-kpi__v">
                {eurSign(b.gross * PILLAR_2.contributionRate.value)}
                <small>/ mes.</small>
              </span>
              <p>Pri reprezentatívnej mzde {eurSign(b.gross)}.</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
