# Štvrtý pilier

Webová aplikácia k diplomovej práci **Návrh individuálneho investičného portfólia ako
alternatívy a doplnku k existujúcim formám dôchodkového zabezpečenia v podmienkach SR**.

Názov pomenúva, čo aplikácia navrhuje: vlastné portfólio ako štvrtý zdroj dôchodkového
príjmu vedľa troch existujúcich pilierov. Značku tvoria štyri stĺpiky, z ktorých je
štvrtý plný a v akcentnej farbe — ten, ktorý si sporiteľ postaví sám. Všetky sú rovnako
vysoké zámerne; vyšší štvrtý by bol tvrdenie, a to je záver výpočtu, nie predpoklad
značky.

Nástroj určí rizikový profil sporiteľa podľa MiFID II, navrhne v jeho pásme tri variantné
portfóliá z reálnych ETF, vyhodnotí ich rizikovo-výnosovými ukazovateľmi a Monte Carlo
simuláciou, a porovná ich s II. a III. pilierom pri zhodnej miere rizika.

Celý výpočet beží v prehliadači. Aplikácia nemá backend, nepoužíva žiadne externé služby
a neodosiela nikam žiadne údaje.

---

## Rýchly štart

```bash
npm install
npm run dev        # vývojový server na http://localhost:5173
npm run build      # produkčná zostava do dist/
npm run preview    # náhľad produkčnej zostavy
npm test           # testy výpočtového jadra
npm run typecheck  # kontrola typov

npm run build:single   # jeden samostatný HTML súbor do dist-single/
```

Node.js 20 alebo novší.

---

## Čo aplikácia robí

| Stránka | Obsah |
| --- | --- |
| **Domov** | Edukatívna časť. Modelový prípad, vplyv nákladovosti, postup a hranice modelu. Všetky čísla sú počítané tým istým modelom ako v nástroji, len na pevne zvolenom vstupe. |
| **Nástroj** | Dotazník MiFID II (16 otázok, 4 oblasti) a parametre sporenia. Postranný panel ukazuje priebežný profil. |
| **Výsledky** | Profil, Monte Carlo simulácia, tri variantné portfóliá, editor váh a fondov, porovnanie s piliermi, odporúčanie. Export do CSV, tlač, zdieľanie odkazom. |
| **Metodika** | Otvorený popis výpočtu vrátane vzorcov a zoznam predpokladov, ktoré model robí. |
| **Dáta a zdroje** | Všetky parametre modelu: triedy aktív, fondy, korelačná matica, právne sadzby a ich pramene. |

---

## Štruktúra

```
src/
  data/           vstupné parametre modelu — jediný zdroj čísel
    assets.ts       triedy aktív, ETF, korelačná matica
    pillars.ts      sadzby a stropy II. a III. piliera, správcovia
    questionnaire.ts dotazník MiFID II
  engine/         výpočet, bez závislosti na rozhraní
    profile.ts      skórovanie dotazníka → rizikový profil
    portfolio.ts    konštrukcia variantov, glide path, kovariančná matica
    metrics.ts      Sharpe, Sortino, VaR, CVaR, maximálny pokles
    projection.ts   deterministická akumulácia, IRR
    montecarlo.ts   simulácia s Choleského rozkladom
    pillars.ts      porovnanie troch ciest
    export.ts       výstup do CSV
  components/
    ui/             tlačidlá, polia, panely
    charts/         grafy kreslené priamo v SVG
    layout/         navigácia a pätička
  pages/          Domov, Nástroj, Výsledky, Metodika, Dáta
  state/          stav aplikácie, smerovanie, odvodená analýza
  styles/         tokeny dizajnového systému a štýly aplikácie
  assets/fonts/   lokálne uložené rezy písma
```

Výpočtové jadro (`src/engine/`) nevie nič o Reacte. Dá sa použiť samostatne, napríklad
na dávkové generovanie tabuliek do príloh práce.

---

## Pred odovzdaním práce: overenie parametrov

Model číta všetky čísla z dvoch súborov. Výmena hodnôt nevyžaduje zásah do výpočtovej
logiky.

### `src/data/assets.ts`

Dlhodobé parametre tried aktív (výnos, volatilita) a korelačná matica sú **východiskové
hodnoty konzistentné s bežne uvádzanými charakteristikami príslušných indexov za obdobie
1999–2024**. Pred odovzdaním ich nahraďte hodnotami z vlastného dátového zdroja,
doplňte `DATA_VINTAGE.verifiedOn` a nastavte `verifiedAgainstPrimarySource: true`.

Rovnako overte `ter` a `isin` každého fondu voči jeho aktuálnemu dokumentu s kľúčovými
informáciami — obe polia sa v čase menia.

### `src/data/pillars.ts`

Sadzby a stropy II. a III. piliera. Parametre označené `verify: true` sa v poslednej
dekáde menili opakovane; overte ich voči Zbierke zákonov, doplňte `LEGAL_VINTAGE.verifiedOn`
a nastavte `verifiedAgainstZbierka: true`.

Kým sú oba príznaky `false`, stránka **Dáta a zdroje** zobrazuje viditeľné upozornenie.
To je zámerné — nedokončené overenie nemá zostať skryté.

---

## Reprodukovateľnosť

Monte Carlo simulácia používa deterministický generátor (Mulberry32) s pevným semienkom,
ktoré je uvedené pri každom grafe aj v exporte. Rovnaké vstupy preto vždy dávajú rovnaké
výsledky a konkrétny výpočet sa dá v práci citovať.

Tlačidlo **Zdieľať výpočet** zakóduje celý stav do adresy. Takýto odkaz obnoví presne ten
istý výpočet u ktoréhokoľvek čitateľa.

---

## Nasadenie

Zostava používa **relatívne cesty**, takže funguje v koreni domény aj
v ľubovoľnom podadresári bez ďalšieho nastavovania. Smerovanie ide cez fragment
adresy (`#/vysledky`), takže nevyžaduje serverové presmerovanie a obnovenie
stránky funguje aj na statickom hostingu.

### GitHub Pages

Workflow `.github/workflows/deploy.yml` zostaví a nasadí aplikáciu pri každom
pushi do hlavnej vetvy. V nastaveniach repozitára prepnite
**Settings → Pages → Source** na *GitHub Actions*.

### Ľubovoľný statický hosting

```bash
npm run build      # výstup v dist/
```

Obsah `dist/` nahrajte kamkoľvek. Netreba nič konfigurovať.

### Príloha práce na dátovom nosiči

```bash
npm run build:single   # výstup v dist-single/index.html
```

Vznikne **jeden samostatný HTML súbor** (približne 470 kB), ktorý má v sebe
vložený JavaScript, štýly aj písma. Otvorí sa dvojklikom, funguje bez servera
aj bez internetu — to je forma vhodná na priloženie k práci.

Dôvod, prečo na to existuje osobitný režim: bežná zostava je ES modul a
prehliadače odmietajú načítať moduly z adresy `file://`, pretože sa vždy
sťahujú cez CORS a súbor na disku nemá pôvod, voči ktorému by sa to dalo
overiť. Jednosúborový režim preto zostaví klasický skript. Zostava sa navyše
sama kontroluje — ak by v HTML zostal odkaz na externý súbor, build zlyhá.

### Absolútne cesty

Ak ich naozaj potrebujete (napríklad za reverznou proxy), nastavte
`BASE_PATH`:

```bash
BASE_PATH=/moja/cesta/ npm run build
```

---

## Testy

```bash
npm test
```

Testy pokrývajú výpočtové jadro: normálne rozdelenie, pozitívnu definitnosť korelačnej
matice, konštrukciu variantov, skórovanie dotazníka vrátane poistiek, zhodu akumulácie
so vzorcom pre budúcu hodnotu anuity, IRR, determinizmus simulácie a rizikovú
konzistenciu porovnania s piliermi. Časť testov je regresná — zachytávajú konkrétne
chyby, ktoré sa pri vývoji vyskytli.

---

## Upozornenie

Štvrtý pilier neposkytuje investičné poradenstvo ani neponúka finančné produkty. Ide o
modelový výpočet na akademické účely. Historické výnosy nie sú prísľubom budúcich.

---

## Licencie

Písma Outfit a IBM Plex Mono sú pod licenciou SIL Open Font License 1.1.
