import { ROUTES, type Route } from '@/state/router';
import { useStore } from '@/state/store';
import { Button } from '@/components/ui';

interface Props {
  route: Route;
  navigate: (to: Route) => void;
}

export function Nav({ route, navigate }: Props) {
  const { state, set } = useStore();
  const isNight = state.theme === 'night';

  return (
    <header className="sp-nav sp-no-print">
      <div className="sp-nav__inner">
        <a
          className="sp-brand"
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true">
            {/* Tri existujúce piliere sú obrysové, štvrtý — ten, ktorý si
                sporiteľ postaví sám — je plný a v akcentnej farbe. Všetky
                štyri sú rovnako vysoké zámerne: vyšší štvrtý stĺpik by bol
                tvrdenie, že vlastné portfólio je najväčšie, a to je záver
                výpočtu, nie predpoklad značky. */}
            <rect x="1" y="5" width="3.4" height="13" rx="1.2" fill="none" stroke="var(--text-strong)" strokeWidth="1.4" />
            <rect x="6.5" y="5" width="3.4" height="13" rx="1.2" fill="none" stroke="var(--text-strong)" strokeWidth="1.4" />
            <rect x="12" y="5" width="3.4" height="13" rx="1.2" fill="none" stroke="var(--text-strong)" strokeWidth="1.4" />
            <rect x="17.5" y="5" width="3.4" height="13" rx="1.2" fill="var(--accent)" />
          </svg>
          Štvrtý pilier
        </a>

        <nav className="sp-nav__links" aria-label="Hlavná navigácia">
          {ROUTES.map((r) => (
            <a
              key={r.path}
              href={`#${r.path}`}
              className={r.optional ? 'is-optional' : undefined}
              aria-current={route === r.path ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(r.path);
              }}
            >
              {r.label}
            </a>
          ))}
        </nav>

        {/* Akcie stoja mimo rolovateľného zoznamu odkazov, aby zostali
            dostupné aj vtedy, keď sa odkazy na úzkej obrazovke rolujú. */}
        <div className="sp-nav__actions">
          <button
            type="button"
            className="sp-icon-btn"
            aria-pressed={isNight}
            title={isNight ? 'Prepnúť na svetlý režim' : 'Prepnúť na tmavý režim'}
            onClick={() => set({ theme: isNight ? 'day' : 'night' })}
          >
            <span className="sp-sr">{isNight ? 'Svetlý režim' : 'Tmavý režim'}</span>
            {isNight ? (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="3.2" />
                <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13.5 9.6A6 6 0 0 1 6.4 2.5a6 6 0 1 0 7.1 7.1Z" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {route !== '/nastroj' && (
            <Button
              variant="signal"
              size="sm"
              className="sp-nav__cta"
              onClick={() => navigate('/nastroj')}
            >
              Zistiť svoj profil
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
