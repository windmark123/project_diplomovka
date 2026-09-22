/**
 * Metodika — otvorený popis toho, ako model počíta.
 *
 * Stránka je súčasťou výstupu práce: oponent aj čitateľ majú mať možnosť
 * overiť každý krok bez čítania zdrojového kódu.
 */

import { AREAS, QUESTION_COUNT } from '@/data/questionnaire';
import { ASSET_CLASSES } from '@/data/assets';
import { MACRO, OWN_PORTFOLIO_TAX, PILLAR_2, PILLAR_3 } from '@/data/pillars';
import { DEFAULT_GLIDEPATH, VARIANTS } from '@/engine/portfolio';
import { PROFILES } from '@/engine/profile';
import { eurSign, pct, pctValue } from '@/engine/format';
import { Label, Note, Panel, SectionHead } from '@/components/ui';

function Formula({ children, note }: { children: string; note?: string }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--s-3)', margin: 'var(--s-5) 0' }}>
      <code
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-small)',
          background: 'var(--surface-sunken)',
          border: '1px solid var(--border-hair)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--s-5)',
          display: 'block',
          overflowX: 'auto',
          whiteSpace: 'pre',
          color: 'var(--text-strong)',
        }}
      >
        {children}
      </code>
      {note && (
        <p className="sp-micro" style={{ margin: 0 }}>
          {note}
        </p>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Panel span={4} padded>
      <div className="sp-row" style={{ alignItems: 'baseline', gap: 'var(--s-5)' }}>
        <span
          className="sp-num"
          style={{ fontSize: 'var(--fs-head)', color: 'var(--text-accent)', fontWeight: 500 }}
        >
          {n}
        </span>
        <h3 className="sp-subhead" style={{ margin: 0 }}>
          {title}
        </h3>
      </div>
      <div className="sp-prose" style={{ marginTop: 'var(--s-6)' }}>
        {children}
      </div>
    </Panel>
  );
}

export function Methodology() {
  return (
    <div className="sp-page sp-page--app sp-section--tight">
      <section>
        <Label>Metodika</Label>
        <h1 className="sp-title" style={{ margin: 'var(--s-5) 0 var(--s-7)', maxWidth: '22ch' }}>
          Ako model počíta a čo pritom predpokladá
        </h1>
        <p className="sp-lead">
          Každý krok je vypísaný aj so vzorcom. Model nepracuje so žiadnym skrytým
          parametrom — všetko, čo ovplyvňuje výsledok, je na tejto stránke alebo
          v prehľade dát.
        </p>
      </section>

      <div className="sp-bento" style={{ marginTop: 'var(--s-10)' }}>
        <Step n="01" title="Profilácia investora">
          <p>
            Dotazník má {QUESTION_COUNT} otázok v {AREAS.length} oblastiach. Každá otázka
            má možnosti oskórované na stupnici 0 až 3. Oblasť sa normalizuje na interval
            ⟨0; 1⟩ ako podiel dosiahnutého a maximálneho skóre.
          </p>
          <Formula note="Váhy zodpovedajú tomu, že schopnosť znášať stratu a ochota ju znášať rozhodujú o vhodnom riziku viac než znalosť pojmov.">
{`skóre = Σ (skóre_oblasti × váha_oblasti) / Σ váha_oblasti

${AREAS.filter((a) => a.weight > 0)
  .map((a) => `  ${a.full.padEnd(24)} váha ${a.weight.toFixed(2)}`)
  .join('\n')}
  ${'Preferencie udržateľnosti'.padEnd(24)} váha 0,00`}
          </Formula>
          <p>
            Oblasť udržateľnosti sa zisťuje, ale do skóre nevstupuje. Delegované
            nariadenie (EÚ) 2021/1253 vyžaduje, aby sa preferencie udržateľnosti
            zisťovali <em>až po</em> určení vhodnosti a aby ju nemenili. V modeli preto
            ovplyvňujú výber konkrétnych fondov, nie rizikové pásmo.
          </p>
          <p>
            Výsledné skóre sa zaradí do jedného zo {PROFILES.length} profilov na hraniciach
            30 %, 52 % a 74 %. Potom sa uplatnia dve poistky, ktoré profil môžu už len
            znížiť:
          </p>
          <ul style={{ fontSize: 'var(--fs-small)', paddingLeft: '1.2em' }}>
            <li>
              Skóre finančnej kapacity pod 35 % zníži profil o jeden stupeň. Kto nemá
              rezervu, býva nútený predať v najhoršom možnom čase.
            </li>
            <li>
              Investičný horizont pod 15 rokov obmedzí profil najviac na rastový, pod 10 rokov na
              vyvážený. Krátky horizont nedáva akciovej zložke čas odpracovať pokles.
            </li>
          </ul>
        </Step>

        <Step n="02" title="Konštrukcia portfólia">
          <p>
            Profil určí pásmo rizikovej zložky, teda súčtu akcií a reálnych aktív.
            V tomto pásme model postaví {VARIANTS.length} varianty, ktoré sa líšia
            metódou konštrukcie:
          </p>
          <ul style={{ fontSize: 'var(--fs-small)', paddingLeft: '1.2em' }}>
            {VARIANTS.map((v) => (
              <li key={v.id}>
                <strong>{v.name}</strong> — {v.method}; riziková váha na{' '}
                {pctValue(v.bandPosition * 100, 0)} pásma profilu.
              </li>
            ))}
          </ul>
          <p>
            Očakávaný výnos portfólia je váženým priemerom výnosov tried aktív znížený
            o váženú nákladovosť zvolených fondov. Volatilita sa počíta z kovariančnej
            matice, nie ako vážený priemer — práve krížové členy zachytávajú efekt
            diverzifikácie:
          </p>
          <Formula note="σ_ij = ρ_ij · σ_i · σ_j. Rozdiel medzi takto počítanou volatilitou a váženým priemerom volatilít je v nástroji zobrazený ako samostatný údaj.">
{`E[r_p] = Σ w_i · r_i − Σ w_i · TER_i

σ²_p  = Σ_i Σ_j  w_i · w_j · ρ_ij · σ_i · σ_j`}
          </Formula>
        </Step>

        <Step n="03" title="Znižovanie rizika pred dôchodkom">
          <p>
            Riziková váha zostáva na pôvodnej úrovni, kým do konca horizontu zostáva viac
            než {DEFAULT_GLIDEPATH.years} rokov. V poslednom úseku klesá lineárne na{' '}
            {pctValue(DEFAULT_GLIDEPATH.endFactor * 100, 0)} pôvodnej hodnoty.
          </p>
          <Formula note="t je počet rokov do konca horizontu, T dĺžka znižovania, f zostatkový podiel. Pomery medzi triedami vnútri rizikovej aj bezpečnej časti zostávajú zachované — mení sa len deliaca čiara.">
{`w_riziko(t) = w_riziko(0) · [ f + (1 − f) · t / T ]   pre t < T
w_riziko(t) = w_riziko(0)                              pre t ≥ T`}
          </Formula>
          <p>
            Ide o rovnaký princíp, aký používajú target-date fondy. Cieľom nie je vyšší
            výnos, ale zúženie rozptylu výsledku v období, keď už na zotavenie nezostáva
            čas.
          </p>
        </Step>

        <Step n="04" title="Akumulácia">
          <p>
            Vklady prichádzajú mesačne na konci mesiaca. Ročná miera sa prepočíta na
            mesačnú geometricky, aby zodpovedala anualizovanému výnosu:
          </p>
          <Formula note="Rovnaká funkcia počíta všetky tri porovnávané cesty. Rozdiely medzi nimi preto nemôžu vzniknúť odlišnou mechanikou výpočtu.">
{`m = (1 + r_ročné)^(1/12) − 1

V_k = V_(k−1) · (1 + m) + vklad`}
          </Formula>
          <p>
            Výnosnosť vlastných vkladov sa vyjadruje vnútornou mierou výnosnosti (IRR)
            peňažných tokov. Pri nepravidelných vkladoch je to jediné korektné meradlo —
            podiel konečnej a vloženej sumy by dĺžku sporenia ignoroval.
          </p>
          <p>
            Reálna hodnota sa počíta deflátorom pri inflácii{' '}
            {pct(MACRO.inflation.value, 1)} p. a. Každá suma má v nástroji vedľa seba
            hodnotu v dnešnej kúpnej sile.
          </p>
        </Step>

        <Step n="05" title="Monte Carlo simulácia">
          <p>
            Ročné výnosy tried aktív sa modelujú ako logaritmicko-normálne rozdelené
            a vzájomne korelované náhodné veličiny. Logaritmicko-normálne rozdelenie je
            zvolené preto, že na rozdiel od normálneho nedovolí výnos pod −100 %, čo je
            pri viacročnej simulácii podstatné.
          </p>
          <Formula note="Korelácia sa zavádza Choleského rozkladom korelačnej matice: z = L · u, kde Σ = L · Lᵀ a u sú nezávislé N(0,1).">
{`σ_log = √( ln(1 + σ² / (1 + μ)²) )
μ_log = ln(1 + μ) − σ_log² / 2

R_i   = exp(μ_log + σ_log · z_i) − 1`}
          </Formula>
          <p>
            Generátor je deterministický a inicializovaný pevným semienkom. Rovnaké
            vstupy preto vždy dávajú rovnaké výsledky — bez toho by výstupy práce neboli
            reprodukovateľné a nedali by sa citovať.
          </p>
          <p>
            Zo simulácie sa čítajú percentilové pásma, rozdelenie konečnej hodnoty,
            maximálny pokles a empirické ukazovatele. Maximálny pokles sa meria na indexe
            zhodnotenia, nie na hodnote účtu: hodnota účtu rastie aj vďaka novým vkladom,
            takže meraná na nej by trhový prepad systematicky podhodnocovala.
          </p>
        </Step>

        <Step n="06" title="Rizikovo-výnosové ukazovatele">
          <p>
            Model uvádza analytické aj empirické ukazovatele. Analytické sú počítané
            v uzavretom tvare a sú porovnateľné naprieč variantmi bez ohľadu na
            simuláciu. Empirické nepredpokladajú normalitu a zachytávajú aj šikmosť,
            ktorú pravidelné vklady do rozdelenia vnášajú.
          </p>
          <Formula>
{`Sharpe   = (E[r_p] − r_f) / σ_p
Sortino  = (E[r_p] − MAR) / DD,  DD = √( Σ min(0, r − MAR)² / n )
VaR_α    = −( μ·T + z_(1−α) · σ·√T )
CVaR_α   = −( μ·T − σ·√T · φ(z_α) / (1 − α) )
MDD      = min_t ( V_t − max_(s≤t) V_s ) / max_(s≤t) V_s`}
          </Formula>
          <p>
            Ako bezriziková sadzba sa používa výnos peňažného trhu, teda{' '}
            {pct(ASSET_CLASSES.find((c) => c.id === 'cash')!.stats.nominalReturn, 1)} p. a.
          </p>
        </Step>

        <Step n="07" title="Porovnanie s piliermi">
          <p>
            Toto je metodicky najcitlivejší krok práce. Výnos dôchodkového fondu sa
            <strong> neberie z jeho historickej výkonnosti</strong>, ale odvodzuje sa
            z rovnakých parametrov tried aktív, aké používa vlastné portfólio:
          </p>
          <Formula note="Fondy s rovnakým podielom akcií tak majú pred odplatou zhodný hrubý výnos. Rozdiel, ktorý model ukazuje, je čistým rozdielom poplatkov a daňového režimu.">
{`r_fond = w_akcie · r_akcie + (1 − w_akcie) · r_dlhopisy − odplata`}
          </Formula>
          <p>
            Pri zapnutom zosúladení rizika sa navyše podiel akciovej zložky fondu nastaví
            na <em>priemernú</em> rizikovú váhu vlastného portfólia za celý horizont,
            teda vrátane vplyvu glide path. Bez toho by sa porovnávalo napríklad 70 %
            akciové portfólio so 100 % akciovým indexovým fondom a rozdiel by nevypovedal
            o nákladovosti, ale o odlišne zvolenom riziku.
          </p>

          <h4 className="sp-subhead" style={{ margin: 'var(--s-7) 0 var(--s-4)' }}>
            Daňový režim
          </h4>
          <ul style={{ fontSize: 'var(--fs-small)', paddingLeft: '1.2em' }}>
            <li>
              <strong>Vlastné portfólio:</strong> príjem z predaja cenných papierov
              prijatých na obchodovanie na regulovanom trhu je oslobodený od dane po
              uplynutí {OWN_PORTFOLIO_TAX.timeTestYears.value} roka držby (
              {OWN_PORTFOLIO_TAX.timeTestYears.source}). Pri dôchodkovom horizonte je
              podmienka splnená pre celý objem. Akumulačné ETF navyše nevyplácajú
              dividendu, takže pri držbe nevzniká priebežný zdaniteľný príjem.
            </li>
            <li>
              <strong>III. pilier:</strong> výnos pri výplate podlieha zrážkovej dani{' '}
              {pct(PILLAR_3.payoutTaxRate.value, 0)}. Príspevky do stropu{' '}
              {eurSign(PILLAR_3.taxReliefCap.value)} ročne znižujú základ dane; model
              predpokladá, že vrátenú sumu sporiteľ opäť vloží na účet.
            </li>
            <li>
              <strong>II. pilier:</strong> model pracuje s nezdanenou akumuláciou.
              Zdanenie vo výplatnej fáze závisí od zvolenej formy výplaty, ktorá je mimo
              rozsahu práce.
            </li>
          </ul>
          <p style={{ marginTop: 'var(--s-5)' }}>
            Do II. piliera nevstupuje vlastný vklad, ale odvod{' '}
            {pct(PILLAR_2.contributionRate.value, 0)} z hrubej mzdy. Preto model uvádza aj
            porovnanie normalizované na 100 € pripísaných mesačne — to meria efektívnosť
            nástroja, nie objem, ktorý doň kto vkladá.
          </p>
        </Step>
      </div>

      <section className="sp-section--tight">
        <SectionHead
          label="Hranice"
          title="Čo model nedokáže a kde sa mýli"
          lead="Uvedenie predpokladov nie je formalita. Ktorýkoľvek z nich môže výsledok posunúť viac než rozdiel medzi porovnávanými cestami."
        />

        <div className="sp-stack">
          <Note tone="warn">
            <strong>Parametre sú odvodené z minulosti.</strong> Model predpokladá, že
            dlhodobé rozdelenie výnosov a korelácií zostane podobné. Korelácie však
            v krízach rastú práve vtedy, keď by diverzifikácia mala pomôcť — skutočný
            pokles teda môže byť hlbší, než simulácia naznačuje.
          </Note>
          <Note tone="warn">
            <strong>Sekvenčné riziko je zachytené len čiastočne.</strong> Simulácia
            generuje nezávislé ročné výnosy, takže nemodeluje dlhšie obdobia
            podpriemernej výkonnosti ani návrat k priemeru. Oboje má na výsledok
            pravidelného sporenia podstatný vplyv.
          </Note>
          <Note tone="info">
            <strong>Výplatná fáza je mimo rozsahu.</strong> Model končí posledným dňom
            akumulácie. Spôsob čerpania — doživotný dôchodok, programový výber či
            postupný predaj portfólia — má na čistý výsledok vplyv porovnateľný
            s poplatkami.
          </Note>
          <Note tone="info">
            <strong>Príspevok zamestnávateľa do III. piliera nie je zahrnutý.</strong> Ak
            ho sporiteľ má, môže prevážiť nákladový handicap DDS. Jeho výška je
            individuálna a nedá sa zovšeobecniť, preto ho model nemodeluje a namiesto
            toho na to upozorňuje vo výsledkoch.
          </Note>
          <Note tone="info">
            <strong>Transakčné náklady a menové riziko nie sú modelované.</strong>{' '}
            Poplatky brokera, rozpätie medzi nákupnou a predajnou cenou ani kolísanie
            kurzu voči doláru do výpočtu nevstupujú. Pri pravidelnom nákupe malých súm
            môžu byť transakčné náklady rádovo porovnateľné s TER.
          </Note>
          <Note tone="info">
            <strong>Správanie sporiteľa sa predpokladá disciplinované.</strong> Model
            počíta s tým, že vklady prichádzajú bez prerušenia a že sporiteľ v poklese
            nepredá. Práve to je v praxi najčastejší dôvod, prečo skutočný výsledok
            zaostane za modelovým.
          </Note>
        </div>
      </section>
    </div>
  );
}
