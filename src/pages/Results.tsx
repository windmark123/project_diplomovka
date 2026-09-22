/**
 * Výsledky — hlavný výstup nástroja.
 *
 * Stránka je vystavaná ako rozprávanie, nie ako zoznam panelov. Otvára ju
 * verdikt s jedným veľkým číslom, potom nasleduje rozpätie scenárov, varianty,
 * editor a až nakoniec porovnanie s piliermi. Poradie je zámerné: najskôr sa
 * ukáže, čo model navrhol a s akou neistotou, a až potom sa to porovnáva —
 * porovnanie hneď na úvode by pôsobilo ako záver bez podkladu.
 *
 * Porovnanie je v záložkách. Štyri pohľady na tie isté čísla naskladané pod
 * seba by z konca stránky spravili nečitateľnú stenu; takto si čitateľ vyberie
 * ten, ktorý ho zaujíma, a ostatné má po ruke.
 */

import { useMemo, useState } from 'react';

import { ASSET_CLASSES, findFund } from '@/data/assets';
import { MACRO, OWN_PORTFOLIO_TAX, PILLAR_2, PILLAR_3, wageBand } from '@/data/pillars';
import {
  eur,
  eurShortSign,
  eurSign,
  pct,
  pctValue,
  ratio,
  signed,
  years as yearsLabel,
} from '@/engine/format';
import { VARIANTS, allocationSlices, normalizeAllocation, riskyShare } from '@/engine/portfolio';
import { simulationStandardError } from '@/engine/montecarlo';
import { fundGrossReturn, type RouteResult } from '@/engine/pillars';
import { downloadCsv, resultsCsv } from '@/engine/export';
import {
  AllocationRing,
  ComparisonBars,
  FanChart,
  ProjectionChart,
  ROUTE_COLOR,
  RiskReturnScatter,
  ValueWaterfall,
} from '@/components/charts';
import {
  Badge,
  Button,
  Field,
  Label,
  Note,
  Panel,
  Range,
  SectionHead,
  Segmented,
  Select,
  Switch,
} from '@/components/ui';
import { AnimatedNumber, Reveal } from '@/components/motion';
import { RISK_FREE, useAnalysis } from '@/state/analysis';
import { useStore } from '@/state/store';
import type { Route } from '@/state/router';

type CompareTab = 'final' | 'per100' | 'costs' | 'table';

const TABS: Array<{ id: CompareTab; label: string }> = [
  { id: 'final', label: 'Konečná hodnota' },
  { id: 'per100', label: 'Na 100 € mesačne' },
  { id: 'costs', label: 'Kam sa stratili peniaze' },
  { id: 'table', label: 'Celá tabuľka' },
];

export function Results({ navigate }: { navigate: (to: Route) => void }) {
  const { state, set, shareUrl } = useStore();
  const a = useAnalysis();
  const [copied, setCopied] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [tab, setTab] = useState<CompareTab>('final');

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

  const spread = sim.terminal.p95 - sim.terminal.p5;

  return (
    <div className="hz-page hz-page--app" style={{ paddingBlock: 'var(--s-9) 0' }}>
      {!a.profile.isComplete && (
        <Note tone="warn" style={{ marginBottom: 'var(--s-7)' }}>
          Dotazník nie je dokončený — zodpovedaných je {a.profile.answeredCount} zo 16
          otázok. Nezodpovedané sa počítajú ako nulové skóre, takže profil aj navrhnuté
          portfólio sú opatrnejšie, než zodpovedá skutočnosti.
        </Note>
      )}

      {/* ── Verdikt ──────────────────────────────────────────────────────── */}
      <Reveal as="section" className="hz-verdict">
        <div className="hz-verdict__grid">
          <div>
            <Label>Váš rizikový profil</Label>
            <h1 className="hz-verdict__name" style={{ marginTop: 'var(--s-5)' }}>
              {profile.name}
            </h1>
            <p
              className="hz-lead"
              style={{ marginTop: 'var(--s-6)', color: 'var(--text-body)', maxWidth: '46ch' }}
            >
              {profile.lead}
            </p>

            <div className="hz-row" style={{ marginTop: 'var(--s-7)', gap: 'var(--s-3)' }}>
              <Badge tone="signal">Skóre {a.profile.score} / 100</Badge>
              <Badge tone="quiet">
                Riziková zložka {profile.equityBand[0]}–{profile.equityBand[1]} %
              </Badge>
              <Badge tone="quiet">
                {state.monthly} € / mes. · {yearsLabel(state.horizon)}
              </Badge>
            </div>
          </div>

          <div>
            <Label>Oproti III. pilieru pri rovnakom vklade a riziku</Label>
            <AnimatedNumber
              className="hz-verdict__figure"
              style={{ marginTop: 'var(--s-5)' }}
              value={cmp.ownVsPillar3}
              format={(v) => signed(v, eurSign)}
            />
            <p className="hz-micro" style={{ margin: 'var(--s-4) 0 var(--s-8)', color: 'var(--text-muted)' }}>
              na konci horizontu. Rovnaké vstupy, rovnaké riziko — líši sa len
              nákladovosť a daňový režim.
            </p>

            <div className="hz-verdict__stats">
              <div className="hz-verdict__stat">
                <Label>Medián</Label>
                <AnimatedNumber value={sim.terminal.p50} format={eurShortSign} className="hz-verdict__stat-v" />
                <span className="hz-micro" style={{ color: 'var(--text-muted)' }}>
                  reálne {eurShortSign(sim.terminal.medianReal)}
                </span>
              </div>
              <div className="hz-verdict__stat">
                <Label>Rozpätie</Label>
                <AnimatedNumber value={spread} format={eurShortSign} className="hz-verdict__stat-v" />
                <span className="hz-micro" style={{ color: 'var(--text-muted)' }}>
                  medzi 5. a 95. percentilom
                </span>
              </div>
              <div className="hz-verdict__stat">
                <Label>Výnosnosť vkladov</Label>
                <AnimatedNumber
                  value={cmp.own.irr * 100}
                  format={(v) => pctValue(v, 2)}
                  className="hz-verdict__stat-v"
                />
                <span className="hz-micro" style={{ color: 'var(--text-muted)' }}>
                  p. a. · III. pilier {pct(cmp.pillar3.irr, 2)}
                </span>
              </div>
              {/* Štvrtý údaj je zámerne ten nepríjemný. Verdikt, ktorý ukazuje
                  len výnos, by komisii aj sporiteľovi zamlčal polovicu veci. */}
              <div className="hz-verdict__stat">
                <Label>Najhorší pokles</Label>
                <AnimatedNumber
                  value={sim.drawdown.worst * 100}
                  format={(v) => pctValue(v, 1)}
                  className="hz-verdict__stat-v"
                />
                <span className="hz-micro" style={{ color: 'var(--text-muted)' }}>
                  naprieč {eur(sim.paths)} scenármi
                </span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── Lepkavý kontext ──────────────────────────────────────────────── */}
      <div className="hz-context hz-no-print">
        <dl>
          <dt>Variant</dt>
          <dd>{state.variant ? VARIANTS.find((v) => v.id === state.variant)?.name : 'Vlastné'}</dd>
        </dl>
        <dl>
          <dt>Riziko</dt>
          <dd>{Math.round(a.stats.risky)} %</dd>
        </dl>
        <dl>
          <dt>Výnos</dt>
          <dd>{pctValue(a.stats.expectedReturn * 100, 2)}</dd>
        </dl>
        <dl>
          <dt>Volatilita</dt>
          <dd>{pctValue(a.stats.volatility * 100, 1)}</dd>
        </dl>
        <div className="hz-row" style={{ marginLeft: 'auto', gap: 'var(--s-2)' }}>
          <Button size="sm" onClick={() => navigate('/nastroj')}>
            Upraviť
          </Button>
          <Button size="sm" onClick={onShare}>
            {copied ? 'Skopírované' : 'Zdieľať'}
          </Button>
          <Button size="sm" onClick={() => downloadCsv('horizont-vysledky.csv', resultsCsv(state, a))}>
            CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            Tlačiť
          </Button>
        </div>
      </div>

      {/* ── Simulácia ────────────────────────────────────────────────────── */}
      <Reveal as="section" className="hz-section--tight">
        <SectionHead
          label="Monte Carlo"
          title="Rozpätie, nie predpoveď"
          lead={`Model vygeneroval ${eur(sim.paths)} scenárov s korelovanými výnosmi tried aktív. Jedno číslo by bolo klamlivé — rozhodujúce je, ako široko sú výsledky rozptýlené a ako často klesnú pod vloženú sumu.`}
        />

        <Panel padded>
          <FanChart
            bands={sim.bands}
            height={360}
            caption={
              <>
                Generátor je deterministický (semienko {sim.seed}), takže rovnaké vstupy
                vždy dajú rovnaký graf. Smerodajná chyba mediánu je{' '}
                {eurSign(simulationStandardError(sim))}.
              </>
            }
          />
        </Panel>

        <div className="hz-kpis" style={{ marginTop: 'var(--s-6)' }}>
          {[
            {
              label: 'Pesimistický scenár',
              value: eurShortSign(sim.terminal.p5),
              desc: '5. percentil — horší výsledok nastal v 5 % scenárov.',
            },
            {
              label: 'Medián',
              value: eurShortSign(sim.terminal.p50),
              desc: `V dnešnej kúpnej sile ${eurSign(sim.terminal.medianReal)}.`,
              tone: 'accent' as const,
            },
            {
              label: 'Optimistický scenár',
              value: eurShortSign(sim.terminal.p95),
              desc: 'Priemer je vyšší než medián, lebo rozdelenie je zošikmené.',
            },
            {
              label: 'Riziko straty',
              value: pctValue(sim.probBelowInvested * 100, 1),
              desc: `Podiel scenárov pod vloženou sumou. Pod jej reálnou hodnotou ${pct(sim.probBelowInvestedReal, 1)}.`,
              tone: sim.probBelowInvested > 0.1 ? ('neg' as const) : undefined,
            },
          ].map((k) => (
            <div key={k.label} className={`hz-kpi hz-metric${k.tone ? ` hz-metric--${k.tone}` : ''}`}>
              <Label>{k.label}</Label>
              <span className="hz-metric__v">{k.value}</span>
              <p>{k.desc}</p>
            </div>
          ))}
        </div>

        <div className="hz-kpis" style={{ marginTop: 'var(--s-3)' }}>
          {[
            {
              label: 'Medián max. poklesu',
              value: pctValue(sim.drawdown.median * 100, 1),
              desc: 'Najhlbší prepad indexu zhodnotenia v typickom scenári.',
            },
            {
              label: 'Najhorší pokles',
              value: pctValue(sim.drawdown.worst * 100, 1),
              desc: 'Naprieč všetkými scenármi. Toto musíte vydržať bez predaja.',
              tone: 'neg' as const,
            },
            { label: 'Sortinov pomer', value: ratio(sim.metrics.sortino), desc: 'Ako Sharpe, ale trestá len výkyvy nadol.' },
            {
              label: 'CVaR 95 %',
              value: pctValue(a.cvar95 * 100, 1),
              desc: `Priemerná ročná strata v najhorších 5 % rokov. VaR je ${pct(a.var95, 1)}.`,
            },
          ].map((k) => (
            <div key={k.label} className={`hz-kpi hz-metric${k.tone ? ` hz-metric--${k.tone}` : ''}`}>
              <Label>{k.label}</Label>
              <span className="hz-metric__v">{k.value}</span>
              <p>{k.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── Varianty ─────────────────────────────────────────────────────── */}
      <Reveal as="section" className="hz-section--tight">
        <SectionHead
          label="Variantné riešenia"
          title="Tri metódy konštrukcie v pásme vášho profilu"
          lead="Všetky tri varianty sú pre váš profil rizikovo prípustné. Líšia sa spôsobom, akým je riziková zložka poskladaná — a teda aj nákladovosťou a mierou diverzifikácie. Kliknutím ich prepnete a celá stránka sa prepočíta."
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

        <div className="hz-rail" style={{ marginTop: 'var(--s-6)' }}>
          {a.variants.map((v, i) => {
            const active = state.variant === v.definition.id;
            return (
              <Reveal key={v.definition.id} index={i}>
                <Panel
                  className={`hz-variant hz-panel--interactive${active ? ' hz-panel--selected' : ''}`}
                  onClick={() => set({ variant: v.definition.id, customAllocation: null })}
                  role="button"
                  tabIndex={0}
                  ariaPressed={active}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      set({ variant: v.definition.id, customAllocation: null });
                    }
                  }}
                >
                  <div className="hz-variant__head">
                    <Label>{v.definition.method}</Label>
                    {active && <Badge tone="signal">Zvolený</Badge>}
                  </div>
                  <h3 className="hz-subhead" style={{ margin: '0 0 var(--s-4)' }}>
                    {v.definition.name}
                  </h3>
                  <p className="hz-micro hz-variant__desc">{v.definition.description}</p>

                  {/* Pružný riadok mriežky by prstenec roztiahol; zloženia
                      s dvoma a siedmimi triedami by potom mali kruh v inej výške. */}
                  <div style={{ alignSelf: 'start' }}>
                    <AllocationRing
                      slices={allocationSlices(v.allocation, state.funds)}
                      size={128}
                      thickness={16}
                      centerValue={`${Math.round(riskyShare(v.allocation))} %`}
                    />
                  </div>

                  <div className="hz-kpis" style={{ marginTop: 'var(--s-6)' }}>
                    {[
                      ['Výnos p. a.', pctValue(v.stats.expectedReturn * 100, 2)],
                      ['Volatilita', pctValue(v.stats.volatility * 100, 1)],
                      ['Sharpe', ratio(v.sharpe)],
                      ['TER', pctValue(v.stats.ter * 100, 2)],
                    ].map(([l, val]) => (
                      <div key={l} className="hz-kpi hz-metric">
                        <Label>{l}</Label>
                        <span className="hz-metric__v" style={{ fontSize: 'var(--fs-head)' }}>
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </Reveal>
            );
          })}
        </div>
      </Reveal>

      <AllocationEditor />

      {/* ── Porovnanie ───────────────────────────────────────────────────── */}
      <Reveal as="section" className="hz-section--tight">
        <SectionHead
          label="Porovnanie"
          title="Vaše portfólio vedľa II. a III. piliera"
          lead={
            cmp.riskMatched
              ? `Fondy v oboch pilieroch sú nastavené na rovnakú rizikovú zložku ako vaše portfólio (${pct(cmp.matchedEquity, 1)} v priemere za horizont). Rozdiel je preto rozdielom poplatkov a daňového režimu — nie odlišne zvoleného rizika.`
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
            height={340}
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
            caption="Priebehy sú pred zdanením výplaty; daň sa uplatní až na konci."
          />
        </Panel>

        <div className="hz-row" style={{ marginTop: 'var(--s-8)', marginBottom: 'var(--s-6)' }}>
          <div className="hz-tabs" role="tablist" aria-label="Pohľady na porovnanie">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                id={`tab-${t.id}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="hz-tabpanel"
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          key={tab}
        >
          {tab === 'final' && (
            <Panel padded>
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
                caption="Čistá hodnota po zdanení výplaty. Tmavší úsek je suma pripísaná na účet, zvyšok zhodnotenie. II. pilier stojí na odvode zo mzdy, nie na vašom vklade — preto sa musí porovnávať aj normalizovane."
              />
            </Panel>
          )}

          {tab === 'per100' && (
            <Panel padded>
              <ComparisonBars
                rows={cmp.routes.map((r) => ({
                  id: r.id,
                  label: r.label,
                  value: cmp.per100[r.id],
                  color: ROUTE_COLOR[r.id],
                  emphasis: r.id === 'own',
                }))}
                caption="Rovnaký objem príspevku vo všetkých troch cestách. Toto je porovnanie efektívnosti nástroja, očistené od toho, koľko doň kto vkladá — a jediné férové meradlo voči II. pilieru."
              />
            </Panel>
          )}

          {tab === 'costs' && (
            <div className="hz-stack hz-stack--lg">
              {cmp.routes.map((r) => (
                <Panel key={r.id} padded label={`${r.label} · ${r.detail}`}>
                  <ValueWaterfall
                    accent={ROUTE_COLOR[r.id]}
                    steps={waterfallFor(r)}
                    caption={costCaption(r)}
                  />
                </Panel>
              ))}
            </div>
          )}

          {tab === 'table' && (
            <>
              <div className="hz-table-wrap">
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
                          {pct(r.id === 'own' ? a.stats.ter : fundGrossReturn(r.equityShare) - r.netReturn, 2)}
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
                Riziková zložka je priemer za celý horizont vrátane vplyvu glide path, nie
                počiatočná váha. Vaše portfólio začína na {Math.round(a.stats.risky)} %
                a postupne klesá — práve na túto priemernú hodnotu sú zosúladené fondy
                v oboch pilieroch.
              </p>
            </>
          )}
        </div>

        <div className="hz-kpis" style={{ marginTop: 'var(--s-7)' }}>
          <div className={`hz-kpi hz-metric hz-metric--${cmp.ownVsPillar3 >= 0 ? 'pos' : 'neg'}`}>
            <Label>Rozdiel voči III. pilieru</Label>
            <span className="hz-metric__v">
              <AnimatedNumber value={cmp.ownVsPillar3} format={(v) => signed(v, eurShortSign)} />
            </span>
            <p>Pri rovnakom vklade {eurSign(state.monthly)} mesačne a zhodnom riziku.</p>
          </div>
          <div className="hz-kpi hz-metric">
            <Label>Ušetrené na poplatkoch</Label>
            <span className="hz-metric__v">
              <AnimatedNumber value={cmp.pillar3.fees - cmp.own.fees} format={eurShortSign} />
            </span>
            <p>
              III. pilier zaplatí {eurSign(cmp.pillar3.fees)}, vaše portfólio{' '}
              {eurSign(cmp.own.fees)}.
            </p>
          </div>
          <div className="hz-kpi hz-metric">
            <Label>Ušetrené na dani</Label>
            <span className="hz-metric__v">
              <AnimatedNumber value={cmp.pillar3.tax} format={eurShortSign} />
            </span>
            <p>
              {state.horizon > OWN_PORTFOLIO_TAX.timeTestYears.value
                ? 'Časový test podľa § 9 ods. 1 písm. k) je splnený, zisk z ETF je oslobodený.'
                : 'Časový test nie je splnený, zisk podlieha dani.'}
            </p>
          </div>
          <div className="hz-kpi hz-metric">
            <Label>Vnútorná výnosnosť</Label>
            <span className="hz-metric__v">
              <AnimatedNumber value={cmp.own.irr * 100} format={(v) => pctValue(v, 2)} />
            </span>
            <p>Vašich vkladov p. a. V III. pilieri {pct(cmp.pillar3.irr, 2)}.</p>
          </div>
        </div>
      </Reveal>

      {/* ── Odporúčanie ──────────────────────────────────────────────────── */}
      <Reveal as="section" className="hz-section--tight">
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
              mzdy {eurSign(band.gross)}, teda{' '}
              {eurSign(band.gross * PILLAR_2.contributionRate.value)} mesačne. Nejde
              o alternatívu k vlastnému vkladu — tieto peniaze by ste inak nemali
              k dispozícii. Porovnanie „na 100 € mesačne“ je preto férovejšie meradlo
              efektívnosti než absolútna hodnota.
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
              Bezriziková sadzba {pct(RISK_FREE, 1)}.
            </p>
            <div className="hz-row hz-no-print">
              <Button onClick={() => navigate('/metodika')}>Ako sa to počíta</Button>
              <Button onClick={() => navigate('/data')}>Dáta a zdroje</Button>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/**
 * Popis pod vodopádom. Vetví sa podľa toho, či cesta daň vôbec platí —
 * veta „a na dani 0 €" by čitateľa nechala hádať, či je to zaokrúhlenie
 * alebo oslobodenie.
 */
function costCaption(r: RouteResult) {
  const beforeFees = r.gross + r.fees;
  const feeShare = pct(r.fees / beforeFees, 1);

  if (r.id === 'own') {
    return `Zisk z ETF je po splnení časového testu oslobodený od dane, preto tu daňový stĺpec chýba. Na poplatkoch odišlo ${eurSign(r.fees)}, teda ${feeShare} hodnoty pred poplatkami.`;
  }
  if (r.tax <= 0) {
    return `Na poplatkoch odišlo ${eurSign(r.fees)}, teda ${feeShare} hodnoty pred poplatkami. Akumulačná fáza druhého piliera sa nezdaňuje; spôsob zdanenia výplaty závisí od jej formy a je mimo rozsahu modelu.`;
  }
  return `Na poplatkoch odišlo ${eurSign(r.fees)} a na dani ${eurSign(r.tax)} — spolu ${pct((r.fees + r.tax) / beforeFees, 1)} hodnoty pred poplatkami.`;
}

/**
 * Kroky vodopádu pre jednu cestu.
 *
 * Zhodnotenie sa berie pred poplatkami (`gross + fees`), inak by boli poplatky
 * započítané dvakrát — hrubá hodnota je už po ich odpočítaní.
 */
function waterfallFor(r: RouteResult) {
  const beforeFees = r.gross + r.fees;
  return [
    { label: 'Pripísané', delta: r.credited, kind: 'base' as const },
    { label: 'Zhodnotenie', delta: beforeFees - r.credited, kind: 'gain' as const },
    { label: 'Poplatky', delta: -r.fees, kind: 'loss' as const },
    ...(r.tax > 0 ? [{ label: 'Daň', delta: -r.tax, kind: 'loss' as const }] : []),
    { label: 'Čistá hodnota', delta: r.net, kind: 'total' as const },
  ];
}

/* ────────────────────────────────────────────────────────────────────────── */

/** Editor váh tried aktív a výberu fondov. */
function AllocationEditor() {
  const { state, set } = useStore();
  const a = useAnalysis();

  const current = useMemo(() => normalizeAllocation(a.allocation), [a.allocation]);

  const setWeight = (id: string, value: number) => {
    set({ variant: null, customAllocation: { ...current, [id]: value } });
  };

  const total = ASSET_CLASSES.reduce((s, c) => s + (current[c.id] ?? 0), 0);

  return (
    <Reveal as="section" className="hz-section--tight">
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
            {[
              ['Výnos p. a.', pctValue(a.stats.expectedReturn * 100, 2)],
              ['Volatilita', pctValue(a.stats.volatility * 100, 1)],
              ['Sharpe', ratio(a.sharpe)],
              ['TER', pctValue(a.stats.ter * 100, 2)],
            ].map(([l, v]) => (
              <div key={l} className="hz-kpi hz-metric">
                <Label>{l}</Label>
                <span className="hz-metric__v" style={{ fontSize: 'var(--fs-head)' }}>{v}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

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
            Riziková zložka klesá lineárne v poslednom úseku horizontu, aby pokles trhu
            tesne pred dôchodkom nezasiahol celý majetok vtedy, keď už nezostáva čas na
            zotavenie.
          </p>
          {state.glidepath.enabled && (
            <div className="hz-stack hz-stack--lg">
              <Field label="Dĺžka znižovania" value={yearsLabel(state.glidepath.years)} htmlFor="gp-years">
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
                hint={`Na konci horizontu zostane ${pctValue(a.stats.risky * state.glidepath.endFactor, 0)} rizikovej zložky.`}
              >
                <Range
                  id="gp-end"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(state.glidepath.endFactor * 100)}
                  onValueChange={(v) => set({ glidepath: { ...state.glidepath, endFactor: v / 100 } })}
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
    </Reveal>
  );
}
