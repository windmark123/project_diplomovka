/**
 * Kontrola kontrastu podľa WCAG 2.1 AA.
 *
 * Skript prejde všetky stránky v oboch farebných režimoch, pre každý textový
 * uzol zloží skutočnú farbu pozadia priechodom cez predkov (vrátane alfa
 * kompozície, ktorú priesvitné sklenené panely vyžadujú) a vypočíta kontrastný
 * pomer. Hlási všetko pod hranicou 4,5:1 pre bežný text a 3:1 pre veľký.
 *
 * Kontroluje aj popisky v grafoch, ktoré nesú farbu cez atribút `fill` —
 * tie bežné nástroje na kontrolu prístupnosti obvykle vynechajú.
 *
 * Spustenie (vyžaduje bežiaci náhľad a nainštalovaný Playwright):
 *
 *   npm run build && npm run preview
 *   npx playwright@1 install chromium      # raz
 *   node scripts/audit-contrast.mjs        # prípadne s BASE=http://…
 *
 * Skript nie je súčasťou závislostí projektu zámerne: Playwright sťahuje
 * prehliadač a spomalil by inštaláciu aj priebeh CI, hoci ide o jednorazovú
 * kontrolu pri zmene palety.
 */

import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const answers = {};
  for (let i = 1; i <= 16; i++) answers['q' + i] = 'o2';
  localStorage.setItem('horizont.state.v1', JSON.stringify({ answers, horizon: 30, monthly: 150 }));
});

const AUDIT = () => {
  const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };

  // Zloží skutočnú farbu pozadia prechodom cez predkov (alfa kompozícia).
  const bgOf = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement.parentNode) {
      const cs = getComputedStyle(node);
      const p = parse(cs.backgroundColor);
      if (p.length >= 3) {
        const a = p.length === 4 ? p[3] : 1;
        if (a > 0) {
          const c = [p[0], p[1], p[2]];
          acc = acc === null ? (a === 1 ? c : { c, a }) : acc;
          if (a === 1) {
            if (acc && acc.c) return acc.c.map((v, i) => Math.round(v * acc.a + c[i] * (1 - acc.a)));
            return c;
          }
        }
      }
      node = node.parentElement;
    }
    return [255, 255, 255];
  };

  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const text = (el.textContent || '').trim();
    if (!text || el.children.length > 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const fg = parse(cs.color).slice(0, 3);
    const bg = bgOf(el);
    const cr = ratio(fg, bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (cr < need) {
      const key = `${el.className}|${cs.color}|${text.slice(0, 18)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        cr: +cr.toFixed(2), need, size: Math.round(size),
        cls: (el.className || el.tagName).toString().slice(0, 38),
        fg: cs.color, bg: `rgb(${bg.join(',')})`,
        text: text.replace(/\s+/g, ' ').slice(0, 34),
      });
    }
  }
  // SVG text sa kontroluje cez fill
  for (const el of document.querySelectorAll('svg text')) {
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.fill).slice(0, 3);
    if (fg.length < 3) continue;
    let p = el.closest('.hz-panel, .hz-slab, body');
    const bg = bgOf(p || document.body);
    const cr = ratio(fg, bg);
    const size = parseFloat(cs.fontSize) || 11;
    if (cr < 4.5) {
      const key = `svg|${cs.fill}|${t.slice(0, 12)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ cr: +cr.toFixed(2), need: 4.5, size: Math.round(size), cls: 'svg text', fg: cs.fill, bg: `rgb(${bg.join(',')})`, text: t.slice(0, 34) });
    }
  }
  return out.sort((a, b) => a.cr - b.cr);
};

let failures = 0;
for (const theme of ['day', 'night']) {
  console.log(`\n${'='.repeat(70)}\nREŽIM: ${theme.toUpperCase()}\n${'='.repeat(70)}`);
  for (const route of ['#/', '#/nastroj', '#/vysledky', '#/metodika', '#/data']) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.evaluate((t) => {
      const raw = JSON.parse(localStorage.getItem('horizont.state.v1') || '{}');
      localStorage.setItem('horizont.state.v1', JSON.stringify({ ...raw, theme: t }));
    }, theme);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const res = await page.evaluate(AUDIT);
    if (res.length === 0) { console.log(`  ${route}  ✓ bez problémov`); continue; }
    failures += res.length;
    console.log(`  ${route}  ✗ ${res.length} prvkov pod hranicou:`);
    for (const r of res.slice(0, 8)) {
      console.log(`     ${String(r.cr).padStart(5)}:1 (treba ${r.need})  ${r.size}px  ${r.cls}`);
      console.log(`            ${r.fg} na ${r.bg}  „${r.text}"`);
    }
  }
}
await browser.close();
process.exit(failures > 0 ? 1 : 0);
