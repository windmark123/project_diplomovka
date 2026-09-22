/**
 * Nástroj — dotazník MiFID II a parametre sporenia.
 *
 * Päť krokov: štyri oblasti dotazníka a parametre. Postranný panel ukazuje
 * priebežný profil, takže sporiteľ vidí, ako jeho odpovede menia výsledok,
 * a nemusí čakať na koniec.
 */

import { useEffect, useMemo, useRef } from 'react';

import { AREAS, QUESTIONS, questionsForArea } from '@/data/questionnaire';
import { MACRO, PILLAR_2, WAGE_BANDS, wageBand } from '@/data/pillars';
import { answersMissing, eurSign, pct, pctValue, years as yearsLabel } from '@/engine/format';
import { evaluateProfile } from '@/engine/profile';
import { accumulate } from '@/engine/projection';
import {
  Button,
  Field,
  Label,
  Meter,
  Note,
  Panel,
  Range,
  Select,
  StepIndicator,
  Switch,
} from '@/components/ui';
import { usePrefersReducedMotion } from '@/components/motion';
import { useStore } from '@/state/store';
import type { Route } from '@/state/router';

const STEP_COUNT = AREAS.length + 1;

export function Tool({ navigate }: { navigate: (to: Route) => void }) {
  const { state, set, setAnswer, reset } = useStore();
  const step = Math.min(STEP_COUNT - 1, state.step);
  const isParamStep = step === AREAS.length;
  const area = isParamStep ? null : AREAS[step];

  const result = useMemo(
    () => evaluateProfile({ answers: state.answers, horizon: state.horizon }),
    [state.answers, state.horizon],
  );

  const stepQuestions = area ? questionsForArea(area.id) : [];
  const missing = stepQuestions.filter((q) => !state.answers[q.id]);

  /**
   * Po prepnutí kroku sa pohľad vráti na začiatok dotazníka.
   *
   * Bez toho zostal používateľ po kliknutí na „Ďalší krok" v mieste, kde
   * predtým rolovaním skončil — teda uprostred alebo na konci nových otázok —
   * a nadpis kroku ani prvú otázku vôbec nevidel.
   *
   * Zároveň sa presunie zameranie na nadpis, aby o zmene vedeli aj čítačky
   * obrazovky a klávesnica pokračovala na správnom mieste. Zameranie by samo
   * osebe pohľad posunulo skokom, preto sa posun potlačí a vykoná sa zvlášť,
   * plynule — alebo okamžite, ak si používateľ vyžiadal obmedzenie pohybu.
   */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const el = headingRef.current;
    if (!el) return;

    el.focus({ preventScroll: true });
    // Lepkavá navigácia je vysoká 62 px; bez odsadenia by nadpis skončil pod ňou.
    const top = el.getBoundingClientRect().top + window.scrollY - 86;
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [step, reducedMotion]);

  const completed = useMemo(
    () =>
      AREAS.map((a) => questionsForArea(a.id).every((q) => !!state.answers[q.id])).concat([
        result.isComplete,
      ]),
    [state.answers, result.isComplete],
  );

  const answered = QUESTIONS.filter((q) => state.answers[q.id]).length;

  // Hrubý náhľad na konečnú hodnotu pri priebežnom profile — len orientačný,
  // presný výpočet s glide path a simuláciou beží až na stránke výsledkov.
  const preview = useMemo(() => {
    const midpoint =
      (result.profile.equityBand[0] + result.profile.equityBand[1]) / 2 / 100;
    const rate = midpoint * 0.085 + (1 - midpoint) * 0.032 - 0.0015;
    return accumulate({ monthly: state.monthly, years: state.horizon, rateAt: () => rate });
  }, [result.profile, state.monthly, state.horizon]);

  const goNext = () => {
    if (isParamStep) {
      navigate('/vysledky');
      return;
    }
    set({ step: step + 1 });
  };

  const band = wageBand(state.wageBandId);
  const pillar2Contribution = band.gross * PILLAR_2.contributionRate.value;

  return (
    <section className="hz-page hz-page--app hz-section--tight">
      <div className="hz-row hz-row--between" style={{ marginBottom: 'var(--s-8)' }}>
        <div>
          <Label>
            Krok {step + 1} z {STEP_COUNT} · {isParamStep ? 'Parametre sporenia' : area!.full}
          </Label>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="hz-title"
            style={{ margin: 'var(--s-4) 0 0', maxWidth: '26ch', outline: 'none' }}
          >
            {isParamStep ? 'Parametre vášho sporenia' : area!.title}
          </h1>
        </div>
        <StepIndicator
          steps={[...AREAS.map((a) => a.name), 'Parametre']}
          current={step}
          completed={completed}
          onSelect={(i) => set({ step: i })}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 'var(--s-7)',
          alignItems: 'start',
        }}
        className="hz-tool-grid"
      >
        <Panel padded>
          <p className="hz-lead" style={{ fontSize: 'var(--fs-body)', marginBottom: 'var(--s-9)' }}>
            {isParamStep
              ? 'Posledný krok. Tieto vstupy sa použijú rovnako pre vaše portfólio, II. aj III. pilier — porovnanie tak stojí na rovnakom základe.'
              : area!.lead}
          </p>

          {!isParamStep && (
            <div className="hz-stack hz-stack--lg">
              {stepQuestions.map((q) => (
                <fieldset key={q.id} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                  <legend
                    style={{
                      padding: 0,
                      marginBottom: 'var(--s-4)',
                      display: 'flex',
                      gap: 'var(--s-4)',
                      alignItems: 'baseline',
                    }}
                  >
                    <span
                      className="hz-num"
                      style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-accent)' }}
                    >
                      {q.num}
                    </span>
                    <span className="hz-subhead">{q.text}</span>
                  </legend>
                  <div className="hz-options">
                    {q.options.map((o) => (
                      <div className="hz-option" key={o.key}>
                        <input
                          type="radio"
                          id={`${q.id}-${o.key}`}
                          name={q.id}
                          checked={state.answers[q.id] === o.key}
                          onChange={() => setAnswer(q.id, o.key)}
                        />
                        <label htmlFor={`${q.id}-${o.key}`}>{o.label}</label>
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          {isParamStep && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 'var(--s-8)',
              }}
            >
              <Field
                label="Mesačný vklad"
                value={eurSign(state.monthly)}
                htmlFor="monthly"
                hint="Suma, ktorú odložíte každý mesiac. Do vlastného portfólia aj do III. piliera vstupuje rovnaká."
              >
                <Range
                  id="monthly"
                  min={20}
                  max={800}
                  step={10}
                  value={state.monthly}
                  onValueChange={(v) => set({ monthly: v })}
                />
              </Field>

              <Field
                label="Investičný horizont"
                value={yearsLabel(state.horizon)}
                htmlFor="horizon"
                hint="Počet rokov do dôchodku. Kratší horizont model zohľadní znížením prípustného rizika."
              >
                <Range
                  id="horizon"
                  min={5}
                  max={45}
                  step={1}
                  value={state.horizon}
                  onValueChange={(v) => set({ horizon: v })}
                />
              </Field>

              <Field
                label="Hrubá mesačná mzda"
                htmlFor="wage"
                hint={`Slúži len na odhad odvodu do II. piliera. Pri tomto pásme je to ${eurSign(
                  pillar2Contribution,
                )} mesačne.`}
              >
                <Select
                  id="wage"
                  value={state.wageBandId}
                  onValueChange={(v) => set({ wageBandId: v })}
                  options={WAGE_BANDS.map((b) => ({ value: b.id, label: b.label }))}
                />
              </Field>

              <Field
                label="Rizikovosť fondu v pilieroch"
                htmlFor="fundrisk"
                hint="Ktorý typ dôchodkového fondu sa má porovnávať, ak vypnete zosúladenie rizika."
              >
                <Select
                  id="fundrisk"
                  value={state.fundRisk}
                  onValueChange={(v) => set({ fundRisk: v as typeof state.fundRisk })}
                  options={[
                    { value: 'index', label: 'Indexový (akciový)' },
                    { value: 'growth', label: 'Akciový / rastový' },
                    { value: 'conservative', label: 'Konzervatívny / garantovaný' },
                  ]}
                />
              </Field>

              <div className="hz-stack" style={{ gridColumn: '1 / -1' }}>
                <Switch
                  checked={state.riskMatched}
                  onCheckedChange={(v) => set({ riskMatched: v })}
                >
                  Porovnávať pri zhodnej miere rizika
                </Switch>
                <p className="hz-field__hint" style={{ margin: 0 }}>
                  Zapnuté: akciová zložka fondov v II. a III. pilieri sa nastaví na
                  priemernú rizikovú váhu vášho portfólia, takže rozdiel medzi cestami je
                  čistým rozdielom poplatkov a dane. Vypnuté: použije sa deklarované
                  zloženie zvoleného fondu a do rozdielu vstúpi aj odlišné riziko.
                </p>

                <Switch
                  checked={state.useTaxRelief}
                  onCheckedChange={(v) => set({ useTaxRelief: v })}
                >
                  Uplatniť daňovú úľavu na III. pilier
                </Switch>
                <p className="hz-field__hint" style={{ margin: 0 }}>
                  Príspevky do zákonného stropu znižujú základ dane. Model predpokladá,
                  že vrátenú sumu sporiteľ opäť vloží na účet.
                </p>
              </div>
            </div>
          )}

          <div
            className="hz-row hz-row--between"
            style={{
              borderTop: '1px solid var(--border-hair)',
              paddingTop: 'var(--s-6)',
              marginTop: 'var(--s-9)',
            }}
          >
            <div className="hz-row" style={{ gap: 'var(--s-3)' }}>
              <Button disabled={step === 0} onClick={() => set({ step: Math.max(0, step - 1) })}>
                Späť
              </Button>
              <Button variant="signal" onClick={goNext}>
                {isParamStep ? 'Zobraziť výsledky' : 'Ďalší krok'}
              </Button>
            </div>
            <span className="hz-num hz-micro">
              vyplnené {answered}/{QUESTIONS.length}
            </span>
          </div>

          {missing.length > 0 && (
            <p className="hz-micro" style={{ marginTop: 'var(--s-5)', color: 'var(--neg-1)' }}>
              V tomto kroku ešte chýba {answersMissing(missing.length)}. Nezodpovedané otázky
              sa počítajú ako nulové skóre, takže profil bude nižší, než v skutočnosti je.
            </p>
          )}
        </Panel>

        <Panel padded className="hz-tool-side">
          <Label>Priebežný profil</Label>
          <h2
            className="hz-title"
            style={{ margin: 'var(--s-4) 0 var(--s-6)', fontSize: 'var(--fs-head)' }}
          >
            {result.profile.name}
          </h2>

          <Meter
            label="Rizikové skóre"
            value={result.score / 100}
            display={pctValue(result.score, 0)}
          />

          <div className="hz-stack hz-stack--sm" style={{ marginTop: 'var(--s-6)' }}>
            {result.areas.map((a) => {
              const weight = AREAS.find((x) => x.id === a.id)?.weight ?? 0;
              return (
                <Meter
                  key={a.id}
                  label={
                    <span>
                      {a.name}
                      <span className="hz-faint" style={{ marginLeft: 6 }}>
                        {a.answered < a.total
                          ? `${a.answered}/${a.total} otázok`
                          : weight > 0
                            ? `váha ${pctValue(weight * 100, 0)}`
                            : 'mimo skóre'}
                      </span>
                    </span>
                  }
                  value={a.value}
                  // Číslo musí vyjadrovať to isté, čo pruh — teda skóre oblasti,
                  // nie počet odpovedí. Postup vypĺňania nesie popisok.
                  display={pctValue(a.value * 100, 0)}
                />
              );
            })}
          </div>

          <hr className="hz-divider" style={{ margin: 'var(--s-7) 0' }} />

          <div className="hz-stack hz-stack--sm">
            <div className="hz-row hz-row--between">
              <span className="hz-micro">Pásmo rizikovej zložky</span>
              <span className="hz-num hz-small">
                {result.profile.equityBand[0]}–{result.profile.equityBand[1]} %
              </span>
            </div>
            <div className="hz-row hz-row--between">
              <span className="hz-micro">Orientačná konečná hodnota</span>
              <span className="hz-num hz-small">{eurSign(preview.final)}</span>
            </div>
            <div className="hz-row hz-row--between">
              <span className="hz-micro">Z toho vložené</span>
              <span className="hz-num hz-small">{eurSign(preview.invested)}</span>
            </div>
          </div>

          {(result.cappedByCapacity || result.cappedByHorizon) && (
            <Note tone="warn" style={{ marginTop: 'var(--s-6)' }}>
              {result.cappedByHorizon
                ? `Horizont ${yearsLabel(
                    state.horizon,
                  )} je pre vyšší profil krátky — akciová zložka by nemala čas odpracovať prípadný pokles, preto model profil obmedzil.`
                : 'Nízka finančná kapacita znížila profil o jeden stupeň. Schopnosť znášať stratu je tvrdé obmedzenie, nie ďalšia vážená položka.'}
            </Note>
          )}

          <p className="hz-micro" style={{ marginTop: 'var(--s-6)' }}>
            Orientačná hodnota počíta so stredom pásma a bez glide path. Presný výpočet
            vrátane simulácie nájdete vo výsledkoch. Inflácia {pct(MACRO.inflation.value, 1)} p. a.
          </p>

          <Button
            variant="quiet"
            size="sm"
            onClick={reset}
            style={{ marginTop: 'var(--s-6)', width: '100%' }}
          >
            Vymazať odpovede
          </Button>
        </Panel>
      </div>
    </section>
  );
}
