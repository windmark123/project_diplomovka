/**
 * Minimalistické smerovanie cez fragment adresy.
 *
 * Fragment je zvolený zámerne: GitHub Pages nevie presmerovať neznáme cesty
 * na index.html, takže cesty typu /vysledky by po obnovení stránky skončili
 * chybou 404. Adresa s `#/vysledky` funguje na ľubovoľnom statickom hostingu
 * aj pri otvorení súboru z disku.
 */

import { useCallback, useEffect, useState } from 'react';

export type Route = '/' | '/nastroj' | '/vysledky' | '/metodika' | '/data';

export const ROUTES: Array<{ path: Route; label: string; optional?: boolean }> = [
  { path: '/', label: 'Domov' },
  { path: '/nastroj', label: 'Nástroj' },
  { path: '/vysledky', label: 'Výsledky' },
  { path: '/metodika', label: 'Metodika' },
  { path: '/data', label: 'Dáta a zdroje', optional: true },
];

const parse = (hash: string): Route => {
  const path = hash.replace(/^#/, '').split('?')[0];
  const found = ROUTES.find((r) => r.path === path);
  return found ? found.path : '/';
};

export function useRoute(): [Route, (to: Route) => void] {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? '/' : parse(window.location.hash),
  );

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((to: Route) => {
    // Zachováme prípadný zdieľaný stav v dotazovacej časti fragmentu.
    const query = window.location.hash.includes('?')
      ? `?${window.location.hash.split('?')[1]}`
      : '';
    window.location.hash = `${to}${query}`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return [route, navigate];
}
