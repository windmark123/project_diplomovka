import { Footer } from '@/components/layout/Footer';
import { Nav } from '@/components/layout/Nav';
import { Data } from '@/pages/Data';
import { Home } from '@/pages/Home';
import { Methodology } from '@/pages/Methodology';
import { Results } from '@/pages/Results';
import { Tool } from '@/pages/Tool';
import { useRoute } from '@/state/router';
import { StoreProvider } from '@/state/store';

function Pages() {
  const [route, navigate] = useRoute();

  return (
    <>
      <Nav route={route} navigate={navigate} />
      <main id="obsah">
        {route === '/' && <Home navigate={navigate} />}
        {route === '/nastroj' && <Tool navigate={navigate} />}
        {route === '/vysledky' && <Results navigate={navigate} />}
        {route === '/metodika' && <Methodology />}
        {route === '/data' && <Data />}
      </main>
      <Footer navigate={navigate} />
    </>
  );
}

export function App() {
  return (
    <StoreProvider>
      <a
        href="#obsah"
        className="hz-btn hz-btn--primary hz-btn--sm"
        style={{ position: 'absolute', left: -9999, top: 8, zIndex: 100 }}
        onFocus={(e) => {
          e.currentTarget.style.left = '8px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px';
        }}
      >
        Preskočiť na obsah
      </a>
      <Pages />
    </StoreProvider>
  );
}
