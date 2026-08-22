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
  t.ok(spenders.length >= 4, `found the routes that call Anthropic (${spenders.length})`);

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
}
