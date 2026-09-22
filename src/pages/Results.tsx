/**
 * Výsledky — hlavný výstup nástroja.
 *
 * Stránka postupuje od profilu cez varianty portfólia a simuláciu až
 * k porovnaniu s piliermi a odporúčaniu. Poradie je zámerné: najskôr sa
 * ukáže, čo model navrhol a s akým rozptylom, a až potom sa to porovnáva —
 * inak by porovnanie pôsobilo ako záver bez podkladu.
 */

import { useMemo, useState } from 'react';

import { ASSET_CLASSES, findFund } from '@/data/assets';
import { MACRO, OWN_PORTFOLIO_TAX, PILLAR_2, PILLAR_3, wageBand } from '@/data/pillars';
import {
  eur,
  eurShort,
  eurSign,
  pct,
  pctValue,
  ratio,
  signed,
  years as yearsLabel,
} from '@/engine/format';
import { VARIANTS, allocationSlices, normalizeAllocation, riskyShare } from '@/engine/portfolio';
import { simulationStandardError } from '@/engine/montecarlo';
import {
  AllocationRing,
  ComparisonBars,
  FanChart,
  ProjectionChart,
  ROUTE_COLOR,
  RiskReturnScatter,
} from '@/components/charts';
import {
  Badge,
  Button,
  Field,
  Kpi,
  Label,
  Note,
  Panel,
  Range,
  SectionHead,
  Segmented,
  Select,
  Switch,
} from '@/components/ui';
import { fundGrossReturn } from '@/engine/pillars';
import { RISK_FREE, useAnalysis } from '@/state/analysis';
import { useStore } from '@/state/store';
import type { Route } from '@/state/router';
import { downloadCsv, resultsCsv } from '@/engine/export';

export function Results({ navigate }: { navigate: (to: Route) => void }) {
  const { state, set, shareUrl } = useStore();
  const a = useAnalysis();
  const [copied, setCopied] = useState(false);
  // Neúplný dotazník výsledky blokuje, kým si ich používateľ vyslovene nevyžiada.
  const [showIncomplete, setShowIncomplete] = useState(false);

  const profile = a.profile.profile;
  const cmp = a.comparison;
  const sim = a.simulation;
  const band = wageBand(state.wageBandId);

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Schránka nemusí byť dostupná; odkaz je aj tak v adresnom riadku po zmene.
      window.location.href = shareUrl();
    }
  };

  if (!a.profile.isComplete && !showIncomplete) {
    return (
      <section className="hz-page hz-page--app hz-section--tight">
        <Panel padded>
          <Label>Dotazník nie je dokončený</Label>
          <h1 className="hz-title" style={{ margin: 'var(--s-5) 0 var(--s-6)', maxWidth: '24ch' }}>
            Výsledky stoja na úplných odpovediach
          </h1>
          <p className="hz-lead" style={{ marginBottom: 'var(--s-8)' }}>
            Zodpovedaných je {a.profile.answeredCount} zo 16 otázok. Nezodpovedané sa
            počítajú ako nulové skóre, takže by vám model navrhol opatrnejšie portfólio,
            než zodpovedá skutočnosti. Výsledky si aj tak môžete pozrieť — len s týmto
            vedomím.
          </p>
          <div className="hz-row">
            <Button variant="signal" onClick={() => navigate('/nastroj')}>
              Dokončiť dotazník
            </Button>
            <Button onClick={() => setShowIncomplete(true)}>Zobraziť neúplné výsledky</Button>
          </div>
        </Panel>
      </section>
    );
  }

  return (
    <div className="hz-page hz-page--app hz-section--tight">
      {!a.profile.isComplete && (
        <Note tone="warn" style={{ marginBottom: 'var(--s-7)' }}>
          Dotazník nie je dokončený — zodpovedaných je {a.profile.answeredCount} zo 16
          otázok. Nezodpovedané sa počítajú ako nulové skóre, takže profil aj navrhnuté
          portfólio sú opatrnejšie, než zodpovedá skutočnosti.
        </Note>
      )}

      {/* ── Profil ───────────────────────────────────────────────────────── */}
      <section>
        <div className="hz-row hz-row--between" style={{ marginBottom: 'var(--s-7)' }}>
          <div>
            <Label>Váš rizikový profil</Label>
            <h1
              className="hz-title"
              style={{ margin: 'var(--s-4) 0 0', fontWeight: 'var(--fw-medium)' }}
            >
              {profile.name}
            </h1>
          </div>
          <div className="hz-row hz-no-print" style={{ gap: 'var(--s-3)' }}>
            <Button size="sm" onClick={() => navigate('/nastroj')}>
              Upraviť vstupy
            </Button>
            <Button size="sm" onClick={onShare}>
              {copied ? 'Odkaz skopírovaný' : 'Zdieľať výpočet'}
            </Button>
            <Button
              size="sm"
              onClick={() => downloadCsv('horizont-vysledky.csv', resultsCsv(state, a))}
            >
              Stiahnuť CSV
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              Tlačiť
            </Button>
          </div>
        </div>

        <div className="hz-split" style={{ alignItems: 'start' }}>
          <p className="hz-lead">{profile.lead}</p>
          <div className="hz-stack">
            <div className="hz-row" style={{ gap: 'var(--s-3)' }}>
              <Badge tone="signal">Skóre {a.profile.score} / 100</Badge>
              <Badge tone="quiet">
                Pásmo rizika {profile.equityBand[0]}–{profile.equityBand[1]} %
              </Badge>
              <Badge tone="quiet">
                {state.monthly} € / mes. · {yearsLabel(state.horizon)}
              </Badge>
            </div>
            {a.profile.cappedByCapacity && (
              <Note tone="warn">
                Nízka finančná kapacita znížila profil o jeden stupeň oproti tomu, čo
                vyšlo zo samotného skóre. Schopnosť znášať stratu je obmedzenie, nie
                ďalšia vážená položka.
              </Note>
            )}
            {a.profile.cappedByHorizon && (
              <Note tone="warn">
                Horizont {yearsLabel(state.horizon)} je pre vyšší profil krátky. Akciová
                zložka by nemala priestor odpracovať pokles, preto model profil obmedzil.
              </Note>
            )}
          </div>
        </div>

        <div className="hz-kpis" style={{ marginTop: 'var(--s-8)' }}>
          <Kpi
            label="Očakávaný výnos"
            value={pctValue(a.stats.expectedReturn * 100, 2)}
            description={`Po poplatkoch fondov. Reálne, po inflácii, ${pct(a.realReturn, 2)}.`}
          />
          <Kpi
            label="Volatilita"
            value={pctValue(a.stats.volatility * 100, 1)}
            description={`Bez diverzifikácie by bola ${pct(
              a.stats.undiversifiedVolatility,
              1,
            )} — rozdiel je efekt korelácií.`}
          />
          <Kpi
            label="Sharpeho pomer"
            value={ratio(a.sharpe)}
            description={`Nadvýnos nad bezrizikovou sadzbou ${pct(RISK_FREE, 1)} na jednotku rizika.`}
          />
          <Kpi
            label="Nákladovosť"
            value={pctValue(a.stats.ter * 100, 2)}
            tone="signal"
            description="Vážený TER zvolených fondov p. a."
          />
        </div>
      </section>

      {/* ── Simulácia ────────────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <SectionHead
          label="Monte Carlo"
          title="Rozpätie, nie predpoveď"
          lead={`Model vygeneroval ${eur(sim.paths)} scenárov s korelovanými výnosmi tried aktív. Jedno číslo by bolo klamlivé — rozhodujúce je, ako široko sú výsledky rozptýlené a ako často klesnú pod vloženú sumu.`}
        />

        <Panel padded>
          <FanChart
            bands={sim.bands}
            height={340}
            caption={
              <>
                Generátor je deterministický (semienko {sim.seed}), takže rovnaké vstupy
                vždy dajú rovnaký graf. Smerodajná chyba mediánu je{' '}
                {eurSign(simulationStandardError(sim))} — pri zvýšení počtu scenárov klesá
                s druhou odmocninou.
              </>
            }
          />
        </Panel>

        <div className="hz-kpis" style={{ marginTop: 'var(--s-6)' }}>
          <Kpi
            label="Medián"
            value={eurShort(sim.terminal.p50)}
            unit="€"
            tone="signal"
            description={`V dnešnej kúpnej sile ${eurSign(sim.terminal.medianReal)}.`}
          />
          <Kpi
            label="Pesimistický scenár"
            value={eurShort(sim.terminal.p5)}
            unit="€"
            description="5. percentil — horší výsledok nastal v 5 % scenárov."
          />
          <Kpi
            label="Optimistický scenár"
            value={eurShort(sim.terminal.p95)}
            unit="€"
            description="95. percentil. Priemer je vyšší než medián, lebo rozdelenie je zošikmené."
          />
          <Kpi
            label="Riziko straty"
            value={pctValue(sim.probBelowInvested * 100, 1)}
            tone={sim.probBelowInvested > 0.1 ? 'neg' : undefined}
            description={`Podiel scenárov pod vloženou sumou. Pod jej reálnou hodnotou ${pct(
              sim.probBelowInvestedReal,
              1,
            )}.`}
          />
        </div>

        <div className="hz-kpis" style={{ marginTop: 'var(--s-3)' }}>
          <Kpi
            label="Medián max. poklesu"
            value={pctValue(sim.drawdown.median * 100, 1)}
            description="Najhlbší prepad indexu zhodnotenia v typickom scenári."
          />
          <Kpi
            label="Najhorší pokles"
            value={pctValue(sim.drawdown.worst * 100, 1)}
            tone="neg"
            description="Naprieč všetkými scenármi. Toto musíte vydržať bez predaja."
          />
          <Kpi
            label="Sortinov pomer"
            value={ratio(sim.metrics.sortino)}
            description="Ako Sharpe, ale trestá len výkyvy nadol."
          />
          <Kpi
            label="CVaR 95 %"
            value={pctValue(a.cvar95 * 100, 1)}
            description={`Priemerná ročná strata v najhorších 5 % rokov. VaR je ${pct(a.var95, 1)}.`}
          />
        </div>
      </section>

      {/* ── Varianty ─────────────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <SectionHead
          label="Variantné riešenia"
          title="Tri metódy konštrukcie v pásme vášho profilu"
          lead="Všetky tri varianty sú pre váš profil rizikovo prípustné. Líšia sa spôsobom, akým je riziková zložka poskladaná — a teda aj nákladovosťou a mierou diverzifikácie."
        />

        <Panel padded>
          <RiskReturnScatter
            points={a.variants.map((v) => ({
              id: v.definition.id,
              label: v.definition.name,
              risk: v.stats.volatility,
              ret: v.stats.expectedReturn,
              sharpe: v.sharpe,
              emphasis: v.definition.id === state.variant,
            }))}
            caption={
              <>
                Plný bod je zvolený variant. Bod vyššie a viac vľavo je efektívnejší.{' '}
                <strong>Osi nezačínajú nulou</strong> — varianty sa líšia desatinami
                percentuálneho bodu a pri nulovej základni by splynuli do jedného bodu.
                Vyššia riziková váha sa nemusí prejaviť vyšším výnosom: pri
                diverzifikovanom variante ju sčasti zje vyššia nákladovosť realitného
                fondu a nižší výnos zlata.
              </>
            }
          />
        </Panel>

        <div className="hz-bento" style={{ marginTop: 'var(--s-6)' }}>
          {a.variants.map((v) => {
            const active = state.variant === v.definition.id;
            return (
              <Panel
                key={v.definition.id}
                span={2}
                className={active ? 'is-active' : undefined}
                style={active ? { borderColor: 'var(--accent)', borderWidth: 2 } : undefined}
              >
                <div className="hz-row hz-row--between" style={{ marginBottom: 'var(--s-5)' }}>
                  <Label>{v.definition.method}</Label>
                  {active && <Badge tone="signal">Zvolený</Badge>}
                </div>
                <h3 className="hz-subhead" style={{ margin: '0 0 var(--s-4)' }}>
                  {v.definition.name}
                </h3>
                <p className="hz-micro" style={{ margin: '0 0 var(--s-6)' }}>
                  {v.definition.description}
                </p>

                <AllocationRing
                  slices={allocationSlices(v.allocation, state.funds)}
                  size={128}
                  thickness={16}
                  centerValue={`${Math.round(riskyShare(v.allocation))} %`}
                />

                <div className="hz-kpis" style={{ marginTop: 'var(--s-6)' }}>
                  <Kpi label="Výnos p. a." value={pctValue(v.stats.expectedReturn * 100, 2)} />
                  <Kpi label="Volatilita" value={pctValue(v.stats.volatility * 100, 1)} />
                  <Kpi label="Sharpe" value={ratio(v.sharpe)} />
                  <Kpi label="TER" value={pctValue(v.stats.ter * 100, 2)} />
                </div>

                <Button
                  variant={active ? 'quiet' : 'signal'}
                  size="sm"
                  disabled={active}
                  onClick={() => set({ variant: v.definition.id, customAllocation: null })}
                  style={{ marginTop: 'var(--s-6)', width: '100%' }}
                >
                  {active ? 'Tento variant je zvolený' : 'Zvoliť tento variant'}
                </Button>
              </Panel>
            );
          })}
        </div>
      </section>

      <AllocationEditor />

      {/* ── Porovnanie ───────────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <SectionHead
          label="Porovnanie"
          title="Vaše portfólio vedľa II. a III. piliera"
          lead={
            cmp.riskMatched
              ? `Fondy v oboch pilieroch sú nastavené na rovnakú akciovú zložku ako vaše portfólio (${pct(
                  cmp.matchedEquity,
                  1,
                )} v priemere za horizont). Rozdiel, ktorý vidíte, je preto rozdielom poplatkov a daňového režimu — nie odlišne zvoleného rizika.`
              : 'Zosúladenie rizika je vypnuté. Porovnávajú sa deklarované zloženia zvolených fondov, takže do rozdielu vstupuje aj odlišná miera rizika.'
          }
          actions={
            <Switch checked={state.riskMatched} onCheckedChange={(v) => set({ riskMatched: v })}>
              Zhodná miera rizika
            </Switch>
          }
        />

        <Panel padded>
          <ProjectionChart
            years={state.horizon}
            height={320}
            series={[
              {
                id: 'own',
                label: `Vlastné portfólio · ${cmp.own.detail}`,
                color: ROUTE_COLOR.own,
                values: cmp.own.series.map((p) => p.value),
              },
              {
                id: 'p3',
                label: `III. pilier · ${cmp.pillar3.detail}`,
                color: ROUTE_COLOR.pillar3,
                values: cmp.pillar3.series.map((p) => p.value),
              },
              {
                id: 'p2',
                label: `II. pilier · ${cmp.pillar2.detail}`,
                color: ROUTE_COLOR.pillar2,
                values: cmp.pillar2.series.map((p) => p.value),
              },
              {
                id: 'invested',
                label: 'Vložená suma',
                color: 'var(--c-invested)',
                values: cmp.own.series.map((p) => p.invested),
                dashed: true,
                secondary: true,
              },
            ]}
            caption="Priebehy sú pred zdanením výplaty; daň sa uplatní až na konci a je v tabuľke nižšie."
          />
        </Panel>

        <div className="hz-split" style={{ marginTop: 'var(--s-6)', alignItems: 'start' }}>
          <Panel padded label="Čistá hodnota na konci horizontu">
            <ComparisonBars
              rows={cmp.routes.map((r) => ({
                id: r.id,
                label: r.label,
                sublabel: r.riskMatched ? 'zosúladené riziko' : undefined,
                value: r.net,
                invested: r.credited,
                color: ROUTE_COLOR[r.id],
                emphasis: r.id === 'own',
              }))}
              caption="Tmavší úsek je suma pripísaná na účet, zvyšok zhodnotenie. II. pilier stojí na odvode zo mzdy, nie na vašom vklade — preto sa musí porovnávať aj normalizovane."
            />
          </Panel>

          <Panel padded label="Na 100 € pripísaných mesačne">
            <ComparisonBars
              rows={cmp.routes.map((r) => ({
                id: r.id,
                label: r.label,
                value: cmp.per100[r.id === 'own' ? 'own' : r.id === 'pillar2' ? 'pillar2' : 'pillar3'],
                color: ROUTE_COLOR[r.id],
                emphasis: r.id === 'own',
              }))}
              caption="Rovnaký objem príspevku vo všetkých troch cestách. Toto je porovnanie efektívnosti nástroja, očistené od toho, koľko doň kto vkladá."
            />
          </Panel>
        </div>

        <div className="hz-table-wrap" style={{ marginTop: 'var(--s-6)' }}>
          <table className="hz-table">
            <caption className="hz-sr">
              Porovnanie troch ciest dôchodkového zabezpečenia na konci horizontu
            </caption>
            <thead>
              <tr>
                <th scope="col">Cesta</th>
                <th scope="col" className="num">Riziková zložka ⌀</th>
                <th scope="col" className="num">Odplata p. a.</th>
                <th scope="col" className="num">Pripísané</th>
                <th scope="col" className="num">Hrubá hodnota</th>
                <th scope="col" className="num">Poplatky</th>
                <th scope="col" className="num">Daň</th>
                <th scope="col" className="num">Čistá hodnota</th>
                <th scope="col" className="num">Reálne</th>
              </tr>
            </thead>
            <tbody>
              {cmp.routes.map((r) => (
                <tr key={r.id} className={r.id === 'own' ? 'is-highlight' : undefined}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    <i
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: ROUTE_COLOR[r.id],
                        marginRight: 8,
                      }}
                    />
                    {r.label}
                    <span className="hz-faint" style={{ display: 'block', marginLeft: 18 }}>
                      {r.detail}
                    </span>
                  </th>
                  <td className="num">{pctValue(r.equityShare * 100, 0)}</td>
                  <td className="num">
                    {pct(r.id === 'own' ? a.stats.ter : feeRate(r.id), 2)}
                  </td>
                  <td className="num">{eurSign(r.credited)}</td>
                  <td className="num">{eurSign(r.gross)}</td>
                  <td className="num">−{eur(r.fees)} €</td>
                  <td className="num">{r.tax > 0 ? `−${eur(r.tax)} €` : '—'}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{eurSign(r.net)}</td>
                  <td className="num">{eurSign(r.netReal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hz-micro" style={{ marginTop: 'var(--s-4)' }}>
          Riziková zložka je priemer za celý horizont, teda vrátane vplyvu glide path —
          nie počiatočná váha. Vaše portfólio začína na {Math.round(a.stats.risky)} %
          a postupne klesá, preto je priemer nižší. Práve na túto priemernú hodnotu sú
          zosúladené fondy v oboch pilieroch.
        </p>

        <div className="hz-kpis" style={{ marginTop: 'var(--s-6)' }}>
          <Kpi
            label="Rozdiel voči III. pilieru"
            value={signed(cmp.ownVsPillar3, eurShort)}
            unit="€"
            tone={cmp.ownVsPillar3 >= 0 ? 'pos' : 'neg'}
            description={`Pri rovnakom vklade ${eurSign(state.monthly)} mesačne a zhodnom riziku.`}
          />
          <Kpi
            label="Ušetrené na poplatkoch"
            value={eurShort(cmp.pillar3.fees - cmp.own.fees)}
            unit="€"
            description={`III. pilier zaplatí ${eurSign(cmp.pillar3.fees)}, vaše portfólio ${eurSign(
              cmp.own.fees,
            )}.`}
          />
          <Kpi
            label="Ušetrené na dani"
            value={eurShort(cmp.pillar3.tax)}
            unit="€"
            description={
              state.horizon > OWN_PORTFOLIO_TAX.timeTestYears.value
                ? `Časový test podľa § 9 ods. 1 písm. k) je splnený, zisk z ETF je oslobodený.`
                : 'Časový test nie je splnený, zisk podlieha dani.'
            }
          />
          <Kpi
            label="Vnútorná výnosnosť"
            value={pctValue(cmp.own.irr * 100, 2)}
            description={`Vašich vkladov p. a. V III. pilieri ${pct(cmp.pillar3.irr, 2)}.`}
          />
        </div>
      </section>

      {/* ── Odporúčanie ──────────────────────────────────────────────────── */}
      <section className="hz-section--tight">
        <div className="hz-split" style={{ alignItems: 'start' }}>
          <div>
            <Label>Odporúčanie pre váš profil</Label>
            <h2 className="hz-title" style={{ margin: 'var(--s-5) 0 0', maxWidth: '20ch' }}>
              Čo z toho vyplýva
            </h2>
          </div>
          <div className="hz-stack">
            <p style={{ margin: 0 }}>{profile.recommendation}</p>
            <Note tone="info">
              Do II. piliera vstupuje odvod {pct(PILLAR_2.contributionRate.value, 0)} z hrubej
              mzdy {eurSign(band.gross)}, teda {eurSign(band.gross * PILLAR_2.contributionRate.value)}{' '}
              mesačne. Nejde o alternatívu k vlastnému vkladu — tieto peniaze by ste inak
              nemali k dispozícii. Porovnanie „na 100 € mesačne“ je preto férovejšie
              meradlo efektívnosti než absolútna hodnota.
            </Note>
            <Note tone="warn">
              Model nezohľadňuje príspevok zamestnávateľa do III. piliera. Ak ho máte,
              môže prevážiť nákladový handicap DDS — vtedy dáva zmysel kombinácia oboch
              ciest, nie voľba jednej.
            </Note>
            <p className="hz-micro" style={{ margin: 0 }}>
              Daňová úľava v III. pilieri je modelovaná do stropu{' '}
              {eurSign(PILLAR_3.taxReliefCap.value)} ročne pri sadzbe{' '}
              {pct(PILLAR_3.incomeTaxRate.value, 0)}. Inflácia {pct(MACRO.inflation.value, 1)} p. a.
            </p>
            <div className="hz-row hz-no-print">
              <Button onClick={() => navigate('/metodika')}>Ako sa to počíta</Button>
              <Button onClick={() => navigate('/data')}>Dáta a zdroje</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  /** Odplata za správu fondu: rozdiel hrubého a čistého výnosu danej cesty. */
  function feeRate(id: 'pillar2' | 'pillar3'): number {
    const route = id === 'pillar2' ? cmp.pillar2 : cmp.pillar3;
    return fundGrossReturn(route.equityShare) - route.netReturn;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */

/** Editor váh tried aktív a výberu fondov. */
function AllocationEditor() {
  const { state, set } = useStore();
  const a = useAnalysis();

  const current = useMemo(
    () => normalizeAllocation(a.allocation),
    [a.allocation],
  );

  const setWeight = (id: string, value: number) => {
    const next = { ...current, [id]: value };
    set({ variant: null, customAllocation: next });
  };

  const total = ASSET_CLASSES.reduce((s, c) => s + (current[c.id] ?? 0), 0);

  return (
    <section className="hz-section--tight">
      <SectionHead
        label="Editor"
        title="Vlastné zloženie"
        lead="Posuňte váhu ktorejkoľvek triedy aktív a všetko nad touto sekciou sa prepočíta. Váhy sa priebežne normalizujú na 100 %, takže netreba počítať zvyšok."
        actions={
          <Segmented
            ariaLabel="Zdroj zloženia"
            value={state.variant ?? 'custom'}
            onValueChange={(v) =>
              v === 'custom'
                ? set({ variant: null, customAllocation: current })
                : set({ variant: v as never, customAllocation: null })
            }
            options={[
              ...VARIANTS.map((v) => ({ value: v.id as string, label: v.name })),
              { value: 'custom', label: 'Vlastné' },
            ]}
          />
        }
      />

      <div className="hz-split" style={{ alignItems: 'start' }}>
        <Panel padded label="Váhy tried aktív">
          <div className="hz-stack hz-stack--lg">
            {ASSET_CLASSES.map((c) => {
              const value = current[c.id] ?? 0;
              return (
                <Field
                  key={c.id}
                  label={
                    <span>
                      <i
                        aria-hidden="true"
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: `var(--c-${c.id})`,
                          marginRight: 8,
                        }}
                      />
                      {c.name}
                    </span>
                  }
                  value={pctValue(value, value < 10 ? 1 : 0)}
                  htmlFor={`w-${c.id}`}
                  hint={
                    <>
                      {findFund(c.id, state.funds[c.id]).ticker} · TER{' '}
                      {pct(findFund(c.id, state.funds[c.id]).ter, 2)} · volatilita{' '}
                      {pct(c.stats.volatility, 1)}
                    </>
                  }
                >
                  <Range
                    id={`w-${c.id}`}
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(value)}
                    onValueChange={(v) => setWeight(c.id, v)}
                  />
                </Field>
              );
            })}
          </div>
          {total < 1 && (
            <Note tone="warn" style={{ marginTop: 'var(--s-6)' }}>
              Všetky váhy sú nulové. Nastavte aspoň jednu triedu aktív.
            </Note>
          )}
        </Panel>

        <Panel padded label="Výsledné zloženie">
            <AllocationRing
              slices={a.slices}
              centerValue={`${Math.round(a.stats.risky)} %`}
              centerLabel="RIZIKO"
            />
            <div className="hz-kpis" style={{ marginTop: 'var(--s-6)' }}>
              <Kpi label="Výnos p. a." value={pctValue(a.stats.expectedReturn * 100, 2)} />
              <Kpi label="Volatilita" value={pctValue(a.stats.volatility * 100, 1)} />
              <Kpi label="Sharpe" value={ratio(a.sharpe)} />
              <Kpi label="TER" value={pctValue(a.stats.ter * 100, 2)} />
            </div>
        </Panel>
      </div>

      {/* Nastavenia tvoria samostatný riadok pod editorom. V dvojstĺpcovom
          rozložení by pravý stĺpec prerástol ľavý o niekoľko sto pixelov
          a vedľa váh by zostalo prázdne miesto. */}
      <div className="hz-editor-settings">
        <Panel padded label="Výber fondov">
            <div className="hz-stack">
              {ASSET_CLASSES.filter((c) => (current[c.id] ?? 0) > 0.05).map((c) => (
                <Field
                  key={c.id}
                  label={c.short}
                  htmlFor={`f-${c.id}`}
                  value={pct(findFund(c.id, state.funds[c.id]).ter, 2)}
                >
                  <Select
                    id={`f-${c.id}`}
                    value={state.funds[c.id]}
                    onValueChange={(v) => set({ funds: { ...state.funds, [c.id]: v } })}
                    options={c.funds.map((f) => ({
                      value: f.ticker,
                      label: `${f.ticker} · ${f.name}`,
                    }))}
                  />
                </Field>
              ))}
            </div>
          </Panel>

          <Panel padded label="Znižovanie rizika pred dôchodkom">
            <Switch
              checked={state.glidepath.enabled}
              onCheckedChange={(v) => set({ glidepath: { ...state.glidepath, enabled: v } })}
            >
              Zapnúť glide path
            </Switch>
            <p className="hz-field__hint" style={{ margin: 'var(--s-4) 0 var(--s-6)' }}>
              Riziková zložka klesá lineárne v poslednom úseku horizontu. Zmyslom je, aby
              pokles trhu tesne pred dôchodkom nezasiahol celý majetok vtedy, keď už
              nezostáva čas na zotavenie.
            </p>
            {state.glidepath.enabled && (
              <div className="hz-stack hz-stack--lg">
                <Field
                  label="Dĺžka znižovania"
                  value={yearsLabel(state.glidepath.years)}
                  htmlFor="gp-years"
                >
                  <Range
                    id="gp-years"
                    min={5}
                    max={25}
                    step={1}
                    value={state.glidepath.years}
                    onValueChange={(v) => set({ glidepath: { ...state.glidepath, years: v } })}
                  />
                </Field>
                <Field
                  label="Zostatková riziková váha"
                  value={pctValue(state.glidepath.endFactor * 100, 0)}
                  htmlFor="gp-end"
                  hint={`Na konci horizontu zostane ${pctValue(
                    a.stats.risky * state.glidepath.endFactor,
                    0,
                  )} rizikovej zložky.`}
                >
                  <Range
                    id="gp-end"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(state.glidepath.endFactor * 100)}
                    onValueChange={(v) =>
                      set({ glidepath: { ...state.glidepath, endFactor: v / 100 } })
                    }
                  />
                </Field>
              </div>
            )}
          </Panel>

          <Panel padded label="Presnosť simulácie">
            <Field
              label="Počet scenárov"
              value={eur(state.paths)}
              htmlFor="paths"
              hint="Viac scenárov znamená stabilnejšie percentily, ale dlhší výpočet. Pri 2 000 je chyba mediánu už pod úrovňou, ktorá by menila závery."
            >
              <Select
                id="paths"
                value={String(state.paths)}
                onValueChange={(v) => set({ paths: Number(v) })}
                options={[500, 1000, 2000, 5000, 10000].map((p) => ({
                  value: String(p),
                  label: `${eur(p)} scenárov`,
                }))}
              />
            </Field>
          </Panel>
      </div>
    </section>
  );
}
