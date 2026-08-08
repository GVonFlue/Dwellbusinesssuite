/* ============================================================
   BRAND / TENANT CONFIG
   ------------------------------------------------------------
   Everything that changes per brokerage lives here, driven by Vite
   env vars. One repo -> many Vercel projects, each with its own
   env vars pointing at its own Supabase.

   Set these in Vercel -> Project -> Settings -> Environment Variables.
   Anything not set falls back to the ProyTech defaults below,
   EXCEPT the Supabase creds, which are required on purpose so a
   misconfigured client project can never fall back to our database.

   DEMO: VITE_DEMO=1 swaps the data layer for an in-memory adapter
   (src/lib/demo.js) and no Supabase creds are needed at all.
   ============================================================ */

const val = (v, d) => { const s = (v ?? '').toString().trim(); return s ? s : d; };
const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'crm';

const NAME = val(import.meta.env.VITE_BRAND_NAME, 'Summit & Vine Realty');

/* The product name, shown at the top of every screen. The client's own brand
   lives in the sidebar; this is ours and it stays put. */
export const PRODUCT = val(import.meta.env.VITE_PRODUCT_NAME, 'ProyTech Business Suite');
export const PRODUCT_SHORT = val(import.meta.env.VITE_PRODUCT_SHORT, 'Business Suite');

export const DEMO = (import.meta.env.VITE_DEMO || '').toString().toLowerCase() === '1'
  || (import.meta.env.VITE_DEMO || '').toString().toLowerCase() === 'true';

export const BRAND = {
  /* identity */
  id:       val(import.meta.env.VITE_BRAND_ID, 'proytech'),
  name:     NAME,
  title:    val(import.meta.env.VITE_APP_TITLE, NAME + ' — ProyTech Business Suite'),
  short:    val(import.meta.env.VITE_BRAND_SHORT, 'Summit & Vine'),
  logo:     val(import.meta.env.VITE_LOGO_URL, ''),

  /* sign-in maps a bare username -> username@<authDomain> in Supabase Auth */
  authDomain: val(import.meta.env.VITE_AUTH_DOMAIN, slug(NAME) + '.app'),

  /* sidebar footer */
  tagline:    val(import.meta.env.VITE_TAGLINE, 'No deadline lives outside the Suite.'),
  taglineSub: val(import.meta.env.VITE_TAGLINE_SUB, 'Read it off the contract, not from memory.'),

  /* which sections this install ships with. Empty = everything on. */
  modules: val(import.meta.env.VITE_MODULES, '').split(',').map(s => s.trim()).filter(Boolean),

  /* the timezone every date in the app is rendered in. Deadlines are DATES,
     never timestamps — see src/lib/dates.js. */
  tz: val(import.meta.env.VITE_TZ, 'America/Chicago'),

  /* colors */
  colors: {
    cobalt: val(import.meta.env.VITE_COLOR_COBALT, '#1338DE'),
    indigo: val(import.meta.env.VITE_COLOR_INDIGO, '#3B3470'),
    ink:    val(import.meta.env.VITE_COLOR_INK,    '#111528'),
    gold:   val(import.meta.env.VITE_COLOR_GOLD,   '#C8A24A'),
    green:  val(import.meta.env.VITE_COLOR_GREEN,  '#1F9D55'),
    red:    val(import.meta.env.VITE_COLOR_RED,    '#D14343'),
  },

  /* appears on client-facing output (net sheets, weekly updates) */
  biz: {
    name:    val(import.meta.env.VITE_BIZ_NAME, NAME),
    address: val(import.meta.env.VITE_BIZ_ADDRESS, '150 N Main St\nWichita, KS 67202').replace(/\\n/g, '\n'),
    email:   val(import.meta.env.VITE_BIZ_EMAIL, 'hello@summitandvine.test'),
    phone:   val(import.meta.env.VITE_BIZ_PHONE, '(316) 555-0140'),
    license: val(import.meta.env.VITE_BIZ_LICENSE, ''),
  },
};

export const icon = f => `/brands/${BRAND.id}/${f}`;

/* Supabase creds are REQUIRED in the real product — no fallback on purpose.
   In demo mode they are irrelevant and never read. */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_KEY || '').trim();
export const SUPABASE_OK  = !!(SUPABASE_URL && SUPABASE_KEY);
