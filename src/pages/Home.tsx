/**
 * Úvodná stránka — edukatívna časť výstupu.
 *
 * Čísla na tejto stránke nie sú ilustračné. Počítajú sa rovnakým modelom ako
 * v nástroji, len na pevne zvolenom modelovom prípade, aby boli porovnateľné
 * naprieč návštevami a citovateľné v texte práce.
 */

import { useMemo } from 'react';

import { ASSET_CLASSES } from '@/data/assets';
import { MACRO, PILLAR_2, PILLAR_3, WAGE_BANDS } from '@/data/pillars';
import { QUESTION_COUNT } from '@/data/questionnaire';
import { eurSign, eurShort, pct, years as yearsLabel } from '@/engine/format';
import {
  VARIANTS,
  allocationSlices,
  buildVariant,
  defaultFundSelection,
  portfolioStats,
} from '@/engine/portfolio';
import { profileById } from '@/engine/profile';
import { compareRoutes, feeSensitivity } from '@/engine/pillars';
import {
  AllocationRing,
  ComparisonBars,
  FeeImpactChart,
  ProjectionChart,
  ROUTE_COLOR,
} from '@/components/charts';
import { Button, Kpi, Label, Note, Panel, SectionHead } from '@/components/ui';
import { AnimatedNumber, Reveal } from '@/components/motion';
import type { Route } from '@/state/router';

/** Modelový prípad, na ktorom stojí celá úvodná stránka. */
const CASE = { monthly: 150, years: 30, wageBandId: 'b3', profile: 'growth' as const };

export function Home({ navigate }: { navigate: (to: Route) => void }) {
  const model = useMemo(() => {
    const funds = defaultFundSelection();
    const profile = profileById(CASE.profile);
    const allocation = buildVariant(VARIANTS[1], profile);
    const stats = portfolioStats(allocation, funds);
    const comparison = compareRoutes({
      allocation,
      funds,
      monthly: CASE.monthly,
      years: CASE.years,
      wageBandId: CASE.wageBandId,
      fundRisk: 'index',
    });
    const fees = feeSensitivity({
      monthly: CASE.monthly,
      years: CASE.years,
      grossReturn: stats.grossReturn,
      feeLevels: Array.from({ length: 13 }, (_, i) => i * 0.00125),
    });
    return {
      funds,
      profile,
      allocation,
      stats,
      comparison,
      fees,
      slices: allocationSlices(allocation, funds),
    };
  }, []);

  const { comparison, stats, fees } = model;
  const wage = WAGE_BANDS.find((b) => b.id === CASE.wageBandId)!;

  // Rozdiel medzi nulovou nákladovosťou a nákladovosťou fondu III. piliera.
  const cheapest = fees[0].final;
  const atDdsFee = fees.find((f) => f.fee >= 0.011)?.final ?? fees[fees.length - 1].final;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="sp-page" style={{ paddingBlock: 'var(--s-13) var(--s-11)' }}>
        <div style={{ overflow: 'hidden' }}>
          <Label className="sp-label--exact">
            <span style={{ color: 'var(--text-accent)' }}>
              MiFID II · II. a III. pilier · {ASSET_CLASSES.length} tried aktív
            </span>
          </Label>
        </div>

        <h1 className="sp-hero-title" style={{ marginTop: 'var(--s-6)', maxWidth: '16em' }}>
          <span className="sp-mask">
            <span>Dôchodok</span>
          </span>
          <span className="sp-mask">
            <span
              className="sp-display"
              style={{ color: 'var(--text-muted)', animationDelay: '110ms' }}
            >
              bez dohadov.
            </span>
          </span>
        </h1>

        <div
          className="sp-split"
          style={{ marginTop: 'var(--s-10)', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr)' }}
        >
          <div className="sp-up" style={{ animationDelay: '260ms' }}>
            <p className="sp-lead">
              Dotazník určí váš rizikový profil. Model postaví vaše portfólio z reálnych ETF
              vedľa fondov DSS a DDS — na rovnakých vstupoch, rovnakom horizonte a pri
              rovnakej miere rizika.
            </p>
            <div className="sp-row" style={{ marginTop: 'var(--s-9)' }}>
              <Button variant="signal" size="lg" onClick={() => navigate('/nastroj')}>
                Spustiť analýzu
              </Button>
              <Button variant="glass" size="lg" onClick={() => navigate('/metodika')}>
                Ako model počíta
              </Button>
            </div>
            <p className="sp-micro" style={{ marginTop: 'var(--s-8)', maxWidth: '44ch' }}>
              Štvrtý pilier neponúka finančné produkty ani investičné poradenstvo. Všetko sa
              počíta vo vašom prehliadači.
            </p>
          </div>

          <Panel className="sp-up" style={{ animationDelay: '340ms' }}>
            <div className="sp-row sp-row--between" style={{ marginBottom: 'var(--s-6)' }}>
              <Label>
                Modelový prípad · {CASE.monthly} € mesačne · {yearsLabel(CASE.years)}
              </Label>
              <span className="sp-num sp-micro">
                profil {model.profile.name.toLowerCase()}, nominálne
              </span>
            </div>

            <div
              className="sp-row"
              style={{ alignItems: 'baseline', gap: 'var(--s-4)', marginBottom: 'var(--s-7)' }}
            >
              <AnimatedNumber
                className="sp-figure"
                value={comparison.ownVsPillar3}
                format={eurShort}
                duration={1500}
              />
              <span className="sp-subhead" style={{ color: 'var(--text-muted)' }}>
                € navyše oproti III. pilieru
              </span>
            </div>

            <ProjectionChart
              years={CASE.years}
              height={240}
              series={[
                {
                  id: 'own',
                  label: 'Vlastné portfólio',
                  color: ROUTE_COLOR.own,
                  values: comparison.own.series.map((p) => p.value),
                },
                {
                  id: 'p3',
                  label: 'III. pilier',
                  color: ROUTE_COLOR.pillar3,
                  values: comparison.pillar3.series.map((p) => p.value),
                },
                {
                  id: 'p2',
                  label: 'II. pilier',
                  color: ROUTE_COLOR.pillar2,
                  values: comparison.pillar2.series.map((p) => p.value),
                },
                {
                  id: 'invested',
                  label: 'Vložená suma',
                  color: 'var(--c-invested)',
                  values: comparison.own.series.map((p) => p.invested),
                  dashed: true,
                  secondary: true,
                },
              ]}
              caption={
                <>
                  Hodnoty pred zdanením výplaty. Do II. piliera nevstupuje vlastný vklad, ale
                  odvod {pct(PILLAR_2.contributionRate.value, 0)} z hrubej mzdy{' '}
                  {eurSign(wage.gross)} — preto je jeho krivka nižšia.
                </>
              }
            />
          </Panel>
        </div>
      </section>

      {/* ── Výstupy ──────────────────────────────────────────────────────── */}
      <Reveal as="section" className="sp-page sp-section" id="vystupy">
        <SectionHead
          label="Výstupy práce"
          title="Čo model počíta a čo z toho vyplýva"
          lead="Každá dlaždica je živý výstup nástroja, nie ilustrácia. Rovnaké vstupy prechádzajú všetkými tromi cestami, takže rozdiely vznikajú výnosom, poplatkom a daňou — nie odlišným zadaním."
        />

        <div className="sp-bento">
          <Panel
            span={2}
            label="Porovnanie na konci horizontu"
            title="Tri cesty, jedno zadanie"
            footnote="Čistá hodnota po zdanení výplaty. Tmavší úsek stĺpca je suma pripísaná na účet, zvyšok je zhodnotenie."
          >
            <ComparisonBars
              rows={comparison.routes.map((r) => ({
                id: r.id,
                label: r.label,
                sublabel: r.id === 'own' ? 'bez dane po časovom teste' : undefined,
                value: r.net,
                invested: r.credited,
                color: ROUTE_COLOR[r.id],
                emphasis: r.id === 'own',
              }))}
            />
          </Panel>

          <Panel
            span={2}
            label="Navrhované portfólio"
            title="Zloženie podľa rizikového profilu"
            footnote={`Profil ${model.profile.name.toLowerCase()}, riziková zložka ${Math.round(
              stats.risky,
            )} % s postupným znižovaním v posledných 15 rokoch.`}
          >
            <AllocationRing
              slices={model.slices}
              centerValue={`${Math.round(stats.risky)} %`}
              centerLabel="RIZIKO"
            />
          </Panel>

          <Panel label="Rizikový profil" title="Dotazník MiFID II">
            <span className="sp-figure">{QUESTION_COUNT}</span>
            <p className="sp-micro" style={{ marginTop: 'var(--s-4)' }}>
              otázok v štyroch oblastiach, vážené skórovanie s poistkami na finančnú
              kapacitu a dĺžku horizontu.
            </p>
          </Panel>

          <Panel label="Simulácia" title="Rozpätie, nie predpoveď">
            <span className="sp-figure">2 000</span>
            <p className="sp-micro" style={{ marginTop: 'var(--s-4)' }}>
              scenárov Monte Carlo s korelovanými výnosmi tried aktív. Výsledkom je
              percentilové pásmo, nie jedno číslo.
            </p>
          </Panel>

          <Panel label="Reálna hodnota" title="Inflačné očistenie všade">
            <span className="sp-figure">{pct(MACRO.inflation.value, 1)}</span>
            <p className="sp-micro" style={{ marginTop: 'var(--s-4)' }}>
              ročne. Každá suma má vedľa seba hodnotu v dnešnej kúpnej sile. Bez výnimky.
            </p>
          </Panel>

          <Panel label="Varianty" title="Tri metódy konštrukcie">
            <span className="sp-figure">{VARIANTS.length}+n</span>
            <p className="sp-micro" style={{ marginTop: 'var(--s-4)' }}>
              návrhy v pásme vášho profilu plus vlastné zloženie, ktoré si nastavíte
              v editore váh.
            </p>
          </Panel>
        </div>
      </Reveal>

      {/* ── Poplatky ─────────────────────────────────────────────────────── */}
      <Reveal as="section" className="sp-slab sp-section" style={{ marginTop: 'var(--section-y)' }}>
        <div className="sp-page">
          <div className="sp-split" style={{ alignItems: 'center' }}>
            <div>
              <Label>Nosné zistenie</Label>
              <h2
                className="sp-display"
                style={{ margin: 'var(--s-5) 0 0', maxWidth: '18ch', color: 'var(--paper-1)' }}
              >
                Jedno percento ročne stojí {pct((cheapest - atDdsFee) / cheapest, 0)} úspor.
              </h2>
              <p className="sp-lead" style={{ marginTop: 'var(--s-7)' }}>
                Poplatok si všimnete na výpise. Rozdiel medzi indexovým ETF a fondom
                s vyššou nákladovosťou si všimnete až na konci horizontu.
              </p>

              <div className="sp-row" style={{ gap: 'var(--s-9)', marginTop: 'var(--s-9)' }}>
                <span style={{ display: 'block' }}>
                  <span className="sp-figure" style={{ color: 'var(--accent)' }}>
                    −{eurShort(cheapest - atDdsFee)}
                  </span>
                  <Label>
                    <span style={{ display: 'block', marginTop: 'var(--s-4)' }}>
                      € pri nákladovosti {pct(0.011, 1)}
                    </span>
                  </Label>
                </span>
                <span style={{ display: 'block' }}>
                  <span className="sp-figure">{pct((cheapest - atDdsFee) / cheapest, 0)}</span>
                  <Label>
                    <span style={{ display: 'block', marginTop: 'var(--s-4)' }}>
                      konečnej hodnoty
                    </span>
                  </Label>
                </span>
              </div>
            </div>

            <Panel padded>
              <FeeImpactChart
                points={fees}
                height={300}
                markers={[
                  {
                    fee: stats.ter,
                    label: `Navrhnuté portfólio · ${pct(stats.ter, 2)}`,
                    color: 'var(--c-own)',
                  },
                  { fee: 0.011, label: `Fond III. piliera · ${pct(0.011, 1)}`, color: 'var(--c-p3)' },
                ]}
                caption={`Konečná hodnota pri ${CASE.monthly} € mesačne počas ${yearsLabel(
                  CASE.years,
                )} a hrubom výnose ${pct(stats.grossReturn, 1)} p. a. Mení sa len nákladovosť.`}
              />
            </Panel>
          </div>
        </div>
      </Reveal>

      {/* ── Postup ───────────────────────────────────────────────────────── */}
      <Reveal as="section" className="sp-page sp-section">
        <SectionHead
          label="Postup"
          title="Tri kroky od dotazníka po porovnanie"
          lead="Metodika je zámerne otvorená. Každý medzivýsledok sa dá skontrolovať a každý parameter zmeniť."
        />

        <div className="sp-bento">
          {[
            {
              n: '01',
              title: 'Profilácia',
              body: `${QUESTION_COUNT} otázok v štyroch oblastiach podľa MiFID II. Vedomosti, finančná kapacita a tolerancia rizika vstupujú do skóre s váhami 0,20 · 0,30 · 0,35. Preferencie udržateľnosti sa zisťujú, ale skóre nemenia — tak, ako to vyžaduje nariadenie (EÚ) 2021/1253.`,
            },
            {
              n: '02',
              title: 'Konštrukcia',
              body: 'Profil určí pásmo rizikovej zložky. V ňom model postaví tri varianty, ktoré sa líšia metódou: minimalistické jadro, replikácia trhového portfólia a rozšírenie o reálne aktíva. Volatilita sa počíta z kovariančnej matice, takže diverzifikácia je v čísle vidieť.',
            },
            {
              n: '03',
              title: 'Vyhodnotenie',
              body: 'Každý variant dostane rizikovo-výnosové ukazovatele a prejde Monte Carlo simuláciou. Porovnanie s II. a III. pilierom prebieha pri zhodnej miere rizika, takže rozdiel je čistým rozdielom poplatkov a daňového režimu.',
            },
          ].map((s) => (
            <Panel key={s.n} span={2} className={undefined}>
              <div className="sp-row" style={{ alignItems: 'baseline', gap: 'var(--s-5)' }}>
                <span
                  className="sp-num"
                  style={{
                    fontSize: 'var(--fs-head)',
                    color: 'var(--text-accent)',
                    fontWeight: 500,
                  }}
                >
                  {s.n}
                </span>
                <h3 className="sp-subhead" style={{ margin: 0 }}>
                  {s.title}
                </h3>
              </div>
              <p style={{ margin: 'var(--s-5) 0 0', fontSize: 'var(--fs-small)' }}>{s.body}</p>
            </Panel>
          ))}
        </div>
      </Reveal>

      {/* ── Hranice modelu ───────────────────────────────────────────────── */}
      <Reveal as="section" className="sp-page sp-section--tight">
        <div className="sp-split">
          <div>
            <Label>Hranice</Label>
            <h2 className="sp-title" style={{ margin: 'var(--s-5) 0 0', maxWidth: '20ch' }}>
              Čo tento model nedokáže
            </h2>
          </div>
          <div className="sp-stack">
            <Note tone="warn">
              Model nepredpovedá budúcnosť. Pracuje s dlhodobými parametrami tried aktív
              odvodenými z minulosti a s predpokladom, že ich rozdelenie zostane podobné.
              Ak sa štrukturálne zmení, výsledky sa zmenia s ním.
            </Note>
            <Note tone="info">
              Výplatná fáza je mimo rozsahu. Model končí posledným dňom akumulácie.
              Spôsob výplaty z II. piliera — doživotný dôchodok či programový výber — má
              na čistý výsledok podstatný vplyv a zaslúži si samostatné spracovanie.
            </Note>
            <Note tone="info">
              Daňová úľava v III. pilieri je modelovaná do stropu{' '}
              {eurSign(PILLAR_3.taxReliefCap.value)} ročne. Príspevok zamestnávateľa,
              ktorý pri DDS býva rozhodujúci, model nezohľadňuje — jeho výška je
              individuálna a nedá sa zovšeobecniť.
            </Note>
          </div>
        </div>
      </Reveal>

      {/* ── Záverečná výzva ──────────────────────────────────────────────── */}
      <Reveal as="section" className="sp-page">
        <Panel padded={false}>
          <div
            style={{
              background: 'var(--accent-fill)',
              color: 'var(--on-accent)',
              padding: 'clamp(28px, 5vw, 56px)',
              display: 'grid',
              gap: 'var(--s-7)',
            }}
          >
            <h2
              className="sp-title"
              style={{ margin: 0, color: 'var(--on-accent)', maxWidth: '20ch' }}
            >
              Rozhodnutie o štyridsiatich rokoch si zaslúži čísla.
            </h2>
            <div className="sp-row">
              <Button variant="glass" size="lg" onClick={() => navigate('/nastroj')}>
                Spustiť analýzu
              </Button>
            </div>
          </div>
        </Panel>

        <div className="sp-kpis" style={{ marginTop: 'var(--s-8)' }}>
          <Kpi
            label="Modelový vklad"
            value={eurShort(CASE.monthly)}
            unit="€ / mes."
            description={`Počas ${yearsLabel(CASE.years)} to je ${eurSign(
              CASE.monthly * 12 * CASE.years,
            )} vložených.`}
          />
          <Kpi
            label="Vlastné portfólio"
            value={eurShort(comparison.own.net)}
            unit="€"
            tone="signal"
            description={`V dnešnej kúpnej sile ${eurSign(comparison.own.netReal)}.`}
          />
          <Kpi
            label="III. pilier"
            value={eurShort(comparison.pillar3.net)}
            unit="€"
            description={`Po zdanení výnosu sadzbou ${pct(PILLAR_3.payoutTaxRate.value, 0)}.`}
          />
          <Kpi
            label="II. pilier"
            value={eurShort(comparison.pillar2.net)}
            unit="€"
            description={`Z odvodu ${pct(
              PILLAR_2.contributionRate.value,
              0,
            )} z hrubej mzdy, nie z vlastného vkladu.`}
          />
        </div>
      </Reveal>
    </>
  );
}
