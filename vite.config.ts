import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Zostava do jediného súboru.
 *
 * Prehliadače odmietajú načítať ES moduly z adresy `file://` — modul sa
 * vždy sťahuje cez CORS a súbor na disku nemá pôvod, voči ktorému by sa
 * dal overiť. Bežná zostava sa preto po dvojkliku neotvorí, aj keď má
 * relatívne cesty.
 *
 * Tento režim preto zostaví klasický skript namiesto modulu a vloží
 * JavaScript, štýly aj písma priamo do HTML. Výsledkom je jeden súbor,
 * ktorý sa otvorí dvojklikom a funguje bez servera aj bez internetu —
 * to je forma, v akej sa aplikácia odovzdáva ako príloha práce.
 */
function inlineEverything(): Plugin {
  return {
    name: 'horizont-inline-everything',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (f) => f.type === 'asset' && f.fileName.endsWith('.html'),
      );
      if (!html || html.type !== 'asset') return;

      const scripts: string[] = [];
      const styles: string[] = [];

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && fileName.endsWith('.js')) {
          scripts.push(chunk.code);
          delete bundle[fileName];
        } else if (chunk.type === 'asset' && fileName.endsWith('.css')) {
          styles.push(String(chunk.source));
          delete bundle[fileName];
        }
      }

      // Značky sa odstraňujú podľa tvaru, nie podľa názvu súboru. Vite ich
      // vie vložiť aj viackrát a zhoda na názov by časť z nich prehliadla —
      // v HTML by potom zostal odkaz na súbor, ktorý už neexistuje.
      let source = String(html.source)
        .replace(/<script\b[^>]*\bsrc=("|')[^"']+\1[^>]*>\s*<\/script>/gi, '')
        .replace(/<link\b[^>]*\brel=("|')(?:stylesheet|modulepreload|preload)\1[^>]*>/gi, '');

      const style = styles.length ? `<style>${styles.join('\n')}</style>` : '';
      // `</script>` v reťazci vnútri kódu by značku predčasne ukončil.
      const script = scripts.length
        ? `<script>${scripts.join('\n;\n').replace(/<\/script>/gi, '<\\/script>')}</script>`
        : '';

      if (style) source = source.replace('</head>', `${style}</head>`);
      // Skript stojí až za `#root`, takže pri spustení element existuje.
      if (script) source = source.replace('</body>', `${script}</body>`);

      html.source = source;
    },
  };
}

/** Overí, že vo výslednom HTML nezostal odkaz na externý súbor. */
function assertSelfContained(): Plugin {
  return {
    name: 'horizont-assert-self-contained',
    enforce: 'post',
    async closeBundle() {
      const html = await readFile('dist-single/index.html', 'utf8');
      const external = [...html.matchAll(/(?:src|href)="(?!data:)([^"]+)"/g)].map((m) => m[1]);
      if (external.length > 0) {
        throw new Error(
          `Zostava do jediného súboru obsahuje externé odkazy: ${external.join(', ')}`,
        );
      }
    },
  };
}

const singleFile = process.env.SINGLE_FILE === '1';

/**
 * Relatívny `base` je zámerný.
 *
 * Aplikácia smeruje cez fragment adresy, takže sa adresa dokumentu pri
 * prechode medzi stránkami nemení. Relatívne cesty k zostaveným súborom preto
 * fungujú rovnako v koreni domény aj v ľubovoľnom podadresári — napríklad na
 * projektovej stránke GitHub Pages.
 *
 * Absolútny `base` by zostavu zviazal s jedným umiestnením a inde by
 * prehliadač nenašiel JavaScript, takže by stránka zostala prázdna.
 * Premennú BASE_PATH nastavte len vtedy, keď absolútne cesty naozaj
 * potrebujete, napríklad za reverznou proxy.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react(), ...(singleFile ? [inlineEverything(), assertSelfContained()] : [])],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: singleFile ? 'dist-single' : 'dist',
    sourcemap: !singleFile,
    // V režime jediného súboru sa písma vložia ako data URI priamo do štýlov.
    assetsInlineLimit: singleFile ? Number.MAX_SAFE_INTEGER : 4096,
    cssCodeSplit: !singleFile,
    rollupOptions: singleFile
      ? {
          output: {
            // Klasický skript namiesto modulu — inak ho prehliadač z disku
            // odmietne načítať.
            format: 'iife',
            inlineDynamicImports: true,
            entryFileNames: 'app.js',
            assetFileNames: 'app.[ext]',
          },
        }
      : undefined,
  },
});
