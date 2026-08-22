/* ============================================================================
   Every route that spends money is behind the guard.

   Four AI routes shipped with NO authentication at all — /api/ai,
   /api/rank-tasks, /api/parse-receipt and /api/extract-contract. They were live
   on a client domain, and anyone who found a URL could spend the install's
   Anthropic key until the card declined.

   That is not the kind of thing to fix once and trust. The check is mechanical:
   any handler that calls api.anthropic.com must call guard() with
   requireAuth, and every browser call to /api/* must go through apiPost, which
   is the only thing that attaches the session token. A guarded route called
   without a token is a broken feature rather than a protected one, so both
   halves have to hold together.

   Pure node — reads the source, mounts nothing.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';

const read = p => fs.readFileSync(p, 'utf8');

export default async function run(t) {
  const apiDir = 'api';
  const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js') && !f.startsWith('_'));

  const spenders = files.filter(f => read(path.join(apiDir, f)).includes('api.anthropic.com'));
  /* Not a count. The first version of this asserted `>= 4` and broke the day a
     dead endpoint was legitimately deleted — a test that fails when you remove
     something is testing the wrong thing. What must hold is that the set is
     non-empty (so a rename cannot silently empty it and pass vacuously) and
     that EVERY member is guarded. */
  t.ok(spenders.length > 0, `found the routes that call Anthropic (${spenders.join(', ')})`);

  for (const f of spenders) {
    const s = read(path.join(apiDir, f));
    t.ok(/guard\(req, res, \{/.test(s), `${f} calls guard()`);
    t.ok(/requireAuth:\s*true/.test(s), `${f} requires a signed-in session`);
    t.ok(/if \(!gate\.ok\) return;/.test(s), `${f} stops when the guard says no`);
  }

  /* The other half: the browser has to send the token. A route can be guarded
     perfectly and still be broken from the app if one screen calls fetch()
     directly. */
  const viewFiles = fs.readdirSync('src/views').filter(f => f.endsWith('.jsx'))
    .map(f => path.join('src/views', f))
    .concat(fs.readdirSync('src/components').filter(f => f.endsWith('.jsx')).map(f => path.join('src/components', f)));

  const raw = [];
  for (const p of viewFiles) {
    const s = read(p);
    /* fetch('/api/…') anywhere is the failure — apiPost is the only caller
       allowed to reach these routes. */
    const m = s.match(/fetch\(\s*['"`]\/api\/[^'"`]+/g);
    if (m) m.forEach(hit => raw.push(`${path.basename(p)}: ${hit}`));
  }
  t.ok(raw.length === 0,
    raw.length ? `no screen calls /api/* with a bare fetch — found ${raw.join(', ')}` : 'no screen calls /api/* with a bare fetch');

  /* apiPost itself must actually attach the header, or all of the above is
     theatre. */
  const data = read('src/lib/data.js');
  t.ok(/authorization:\s*`Bearer \$\{tok\}`/.test(data), 'apiPost attaches the bearer token');
  t.ok(/auth\.session\(\)/.test(data), 'and gets it from the live session');

  /* ---- Supabase credentials come from ONE place ---------------------------
     Three files used to read these variables differently: _guard and _spend
     accepted either spelling of the key and fell back to VITE_SUPABASE_URL,
     _google and notify accepted neither. The asymmetry is invisible at setup
     and expensive later — an install that set only the short key name got a
     working assistant and a Google Calendar integration that silently could
     not read its own token.

     Patching those files fixes the instances. THIS is what kills the class:
     nothing under api/ may read the variables directly, so the next file to
     need Supabase credentials gets both spellings and both fallbacks by
     construction rather than by somebody remembering. */
  {
    const apiFiles = fs.readdirSync('api').filter(f => f.endsWith('.js'));
    const direct = [];
    for (const f of apiFiles) {
      if (f === '_env.js') continue;              // the one place allowed to
      const s2 = read(path.join('api', f));
      for (const m of s2.matchAll(/process\.env\.(VITE_)?SUPABASE[A-Z_]*/g)) direct.push(`${f}: ${m[0]}`);
    }
    t.ok(direct.length === 0,
      direct.length
        ? `only _env.js may read the Supabase variables — found ${direct.join(', ')}`
        : 'only _env.js reads the Supabase variables; everything else imports it');

    const env = read('api/_env.js');
    t.ok(/SUPABASE_URL/.test(env) && /VITE_SUPABASE_URL/.test(env),
      'and _env.js accepts both spellings of the URL');
    t.ok(/SUPABASE_SERVICE_KEY/.test(env) && /SUPABASE_SERVICE_ROLE_KEY/.test(env),
      'and both spellings of the service key');
    /* the asymmetry that IS deliberate: a VITE_ variable is compiled into the
       browser bundle, and this key bypasses RLS entirely */
    t.ok(!/VITE_SUPABASE_SERVICE/.test(env),
      'while the service key has NO VITE_ fallback — that one would ship the key to the browser');
  }

  /* ---- the diagnostics actually fire -------------------------------------
     A log line nobody has seen print is a log line that does not print. These
     drive the real functions with the real environment this box has (no
     SUPABASE_URL, no service key, no Anthropic key) and assert both halves:
     the server says which precondition failed, and the CALLER's message is
     unchanged. */
  const said = [];
  const realError = console.error;
  console.error = (...a) => said.push(a.join(' '));
  try {
    const { guard } = await import('../api/_guard.js?diag=1');
    const req = { method: 'POST', headers: { authorization: 'Bearer not-a-real-token' }, body: {} };
    let code = 0, sent = null;
    const res = { status(c) { code = c; return this; }, json(b) { sent = b; return this; }, setHeader() {} };
    const gate = await guard(req, res, { name: 'diagnostic-probe', requireAuth: true });

    t.ok(gate.ok === false, 'the guard refuses when it cannot verify');
    t.ok(code === 401 && sent && sent.error === 'Session expired.',
      'and the caller still sees exactly "Session expired." — unchanged', JSON.stringify(sent));
    /* names the ACTUAL variable, both halves. The first version of this
       assertion looked for the words "service key", which only appear in the
       branch where the key IS present — so it failed against a correct log
       line. The log was right; the test was not. */
    t.ok(said.some(l => /SUPABASE_URL/.test(l) && /SUPABASE_SERVICE_ROLE_KEY/.test(l)),
      'while the SERVER log names both missing variables by name', said.join(' | ').slice(0, 220));
    t.ok(said.some(l => /every guarded endpoint/i.test(l)),
      'and says the whole deployment is affected, not just this route');

    const { aiKey } = await import('../api/_aikey.js?diag=1');
    said.length = 0;
    const before = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    t.eq(aiKey('probe'), '', 'aiKey returns empty when the variable is unset');
    t.ok(said.some(l => /NOT SET/.test(l)), 'and says NOT SET', said.join(' | '));

    said.length = 0;
    process.env.ANTHROPIC_API_KEY = '   ';
    t.eq(aiKey('probe'), '', 'and when it is whitespace');
    t.ok(said.some(l => /EMPTY/.test(l)), 'it says EMPTY, which is a different mistake', said.join(' | '));

    said.length = 0;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-short';
    t.ok(aiKey('probe') !== '', 'a short key is still returned — it might be valid');
    t.ok(said.some(l => /truncated/.test(l)), 'but it is flagged as possibly truncated', said.join(' | '));

    said.length = 0;
    const { logAiFailure } = await import('../api/_aikey.js?diag=1');
    logAiFailure('probe', 401, { error: { message: 'invalid x-api-key' } });
    t.ok(said.some(l => /REJECTED/.test(l) && /invalid x-api-key/.test(l)),
      'and a 401 from Anthropic reads as the key being rejected, not missing', said.join(' | '));

    if (before === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = before;
  } finally {
    console.error = realError;
  }
}
