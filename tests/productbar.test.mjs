/* ============================================================================
   productbar.test.mjs — our mark in someone else's tool is a per-install choice.

   The bar across the top carries our wordmark, our product line and
   "built for <client>". That is right for an install we sell FROM and wrong for
   one we white-label, and those are different clients — so it has to be a
   variable, and a variable with no test is a switch that silently stops working.

   Three things are asserted, and the third is the one that would actually bite:

     1. PRODUCT_BAR resolves each documented mode, and an unrecognised value
        falls back to `full` LOUDLY. Quietly defaulting a typo to `off` would
        remove our mark and look deliberate; quietly defaulting it to `full`
        would leave it showing on an install we promised to white-label. Either
        direction is a lie, so the fallback says which one it took.

     2. Both render sites are guarded. Hiding the wordmark and leaving the
        product line in the sidebar is not "off", it is half off — and it is
        exactly what happens when someone edits one JSX block and not the other.

     3. The demo marker survives `off`. It is not branding: it is the difference
        between a prospect clicking a sandbox and believing they are looking at
        live data.

   Pure — reads source and evaluates brand.js under different environments. No
   DOM, so it runs without the harness.
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(path.join(ROOT, f), 'utf8');

/* Evaluate brand.js under a given environment and hand back what it exported. */
async function brandUnder(env) {
  const esbuild = await import('esbuild');
  const out = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/lib/brand.js')],
    bundle: true, write: false, format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env': '__ENV__' },
    banner: { js: 'const __ENV__=' + JSON.stringify({ MODE: 'test', DEV: false, PROD: true, ...env }) + ';' },
  });
  const b64 = Buffer.from(out.outputFiles[0].text).toString('base64');
  return import('data:text/javascript;base64,' + b64);
}

export default async function run(t) {
  /* -------------------------------------------------------------- 1. modes */
  for (const [value, expected] of [
    [undefined,   'full'],
    ['full',      'full'],
    ['name-only', 'name-only'],
    ['off',       'off'],
    ['NAME-ONLY', 'name-only'],   // case is not a typo
  ]) {
    const m = await brandUnder(value === undefined ? {} : { VITE_PRODUCT_BAR: value });
    t.ok(m.PRODUCT_BAR === expected,
      `VITE_PRODUCT_BAR=${value === undefined ? '(unset)' : value} -> ${expected} (got ${m.PRODUCT_BAR})`);
  }

  /* An unset variable must mean FULL, so merging this changes no install. */
  const dflt = await brandUnder({});
  t.ok(dflt.PRODUCT_BAR === 'full', 'unset defaults to full — existing installs are untouched');

  /* A typo must not read as a decision, in either direction. */
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  const bad = await brandUnder({ VITE_PRODUCT_BAR: 'hidden' });
  console.warn = realWarn;
  t.ok(bad.PRODUCT_BAR === 'full', 'an unrecognised value falls back to full, not to off');
  t.ok(warnings.some(w => /VITE_PRODUCT_BAR/.test(w) && /hidden/.test(w)),
    '  and says so by name, naming the value it rejected');

  /* ------------------------------------------------------- 2. both sites */
  const app = read('src/App.jsx');

  t.ok(/PRODUCT_BAR\s*!==\s*'off'\s*&&\s*\(\s*\n?\s*<div className="suite-bar">/.test(app),
    'the top bar is removed entirely by off');
  t.ok(/PRODUCT_BAR\s*===\s*'full'\s*&&\s*\(/.test(app),
    '  and the wordmark alone is removed by name-only');

  /* The sidebar is the site that gets forgotten: it renders PRODUCT_SHORT too,
     in a different component, hundreds of lines away from the bar.

     COMMENTS ARE STRIPPED FIRST. The first version of this check searched the
     raw slice for 'PRODUCT_BAR' — and the explanatory comment sitting directly
     above the JSX contains that word, so deleting the guard left the test
     green. It was verified by deleting the guard and watching it pass. */
  const strip = x => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const sb = strip(app.slice(app.indexOf('className="sb-brand"'), app.indexOf('className="sb-nav"')));
  t.ok(/PRODUCT_BAR\s*!==\s*'off'\s*&&\s*<span className="sb-suite">/.test(sb),
    'the sidebar product line is governed by the same switch, not left behind');

  /* ------------------------------------------------------- 3. the demo */
  t.ok(/isDemo\s*\n?\s*\?\s*<span className="sb-suite">/.test(app),
    'a demo still says it is a demo, whatever PRODUCT_BAR says');

  /* --------------------------------------------- 4. the mark is a variable */
  const assets = read('src/lib/assets.js');
  t.ok(/productLogo:\s*BRAND\.productLogo\s*\|\|/.test(assets),
    'our mark reads VITE_PRODUCT_LOGO_URL, falling back to the bundled file');
  const brand = read('src/lib/brand.js');
  t.ok(/productLogo:\s*val\(import\.meta\.env\.VITE_PRODUCT_LOGO_URL/.test(brand),
    '  and that variable exists on BRAND');
}
