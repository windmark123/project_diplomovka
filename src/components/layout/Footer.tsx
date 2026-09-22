import { DATA_VINTAGE } from '@/data/assets';
import { LEGAL_VINTAGE } from '@/data/pillars';
import type { Route } from '@/state/router';

export function Footer({ navigate }: { navigate: (to: Route) => void }) {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-hair)',
        marginTop: 'var(--section-y)',
        paddingBlock: 'var(--s-11) var(--s-9)',
      }}
    >
      <div className="sp-page">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--s-9)',
          }}
        >
          <div className="sp-stack">
            <span className="sp-label">O projekte</span>
            <p className="sp-micro" style={{ margin: 0, maxWidth: '40ch' }}>
              Štvrtý pilier je výstupom diplomovej práce na tému návrhu individuálneho
              investičného portfólia ako alternatívy a doplnku k existujúcim formám
              dôchodkového zabezpečenia v podmienkach Slovenskej republiky.
            </p>
          </div>

          <div className="sp-stack">
            <span className="sp-label">Rozsah modelu</span>
            <p className="sp-micro" style={{ margin: 0, maxWidth: '40ch' }}>
              Parametre tried aktív vychádzajú z obdobia {DATA_VINTAGE.period}, vyjadrené
              v {DATA_VINTAGE.currency}. Právne parametre boli overené{' '}
              {LEGAL_VINTAGE.verifiedOn}. Podrobný rozpis nájdete v{' '}
              <a
                href="#/data"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/data');
                }}
              >
                prehľade dát a zdrojov
              </a>
              .
            </p>
          </div>

          <div className="sp-stack">
            <span className="sp-label">Upozornenie</span>
            <p className="sp-micro" style={{ margin: 0, maxWidth: '40ch' }}>
              Štvrtý pilier neposkytuje investičné poradenstvo ani neponúka finančné produkty.
              Ide o modelový výpočet na akademické účely. Historické výnosy nie sú
              prísľubom budúcich. Všetky výpočty prebiehajú vo vašom prehliadači a žiadne
              údaje sa neodosielajú.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
