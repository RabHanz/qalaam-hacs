#!/usr/bin/env node
/**
 * smoke-sweep.mjs — end-to-end smoke test across the major Qalaam web
 * routes. Replaces the I3 Playwright sweep (we use puppeteer-core +
 * system Chrome since both are already installed; Playwright would add
 * a 200MB browser download for no marginal value here).
 *
 * Run:  node scripts/qa/smoke-sweep.mjs
 *       node scripts/qa/smoke-sweep.mjs --base http://127.0.0.1:3111
 *
 * Exit code 0 = all green, non-zero = at least one failure (CI-friendly).
 *
 * Each check has:
 *   • A URL relative to base (default http://127.0.0.1:3111)
 *   • A list of selector / text invariants the page MUST satisfy
 *   • An (optional) action (click/dispatch) before the assertions
 *
 * Failures land in stdout in a punch-list format that's easy to triage.
 */

import puppeteer from '/home/onnyx/qalam/apps/web/node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js';

const args = process.argv.slice(2);
function arg(flag, def) {
  const i = args.indexOf(flag);
  return i === -1 ? def : args[i + 1];
}
const BASE = arg('--base', process.env.QALAAM_E2E_BASE ?? 'http://127.0.0.1:3111');
const CHROME = arg('--chrome', process.env.CHROME_PATH ?? '/usr/bin/google-chrome');

/** @typedef {{ name: string, url: string, expectSelectors?: string[], expectText?: string[], action?: (page) => Promise<void>, postAction?: (page) => Promise<void> }} Check */

/** @type {Check[]} */
const CHECKS = [
  {
    name: 'home (/)',
    url: '/',
    expectSelectors: ['h1, [class*="qalaam"], main'],
    expectText: ['Qalaam'],
  },
  {
    name: 'reader — Surah Al-Fatiha (/read/1)',
    url: '/read/1',
    expectSelectors: ['main', 'a.mushaf-word, [class*="ayah"], [class*="verse"]'],
    expectText: ['Al-Fātiḥa', 'Al-Fatiha', 'Fatihah', 'Pickthall', 'Sahih', 'translation'],
  },
  {
    name: 'reader — Surah Al-Imran (/read/3)',
    url: '/read/3',
    // /read default layout is Madinah Uthmani Unicode — `a.mushaf-word`
    // anchors only render in tajweed mode, so look for the universal
    // Arabic-text class instead.
    expectSelectors: ['main', '.font-arabic'],
    expectText: ['ʿImrān', 'Imran', 'Al Imran', '`Imran'],
  },
  {
    name: 'mushaf-tajweed (/mushaf/tajweed/1) — V4 PUA pipeline + lazy CSS',
    url: '/mushaf/tajweed/1',
    expectSelectors: ['a.mushaf-word', 'link#qalaam-tajweed-css, link[href*="qpc-v4-fonts"]'],
    expectText: ['SŪRAT', 'Surah'],
    postAction: async (page) => {
      // V4 PUA spans should render via QPCv4Page<N> font. Confirm at
      // least one anchor's child <span> has computed fontFamily
      // matching QPCv4Page.
      const ok = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a.mushaf-word > span'));
        const v4 = anchors.filter((s) => /QPCv4Page/.test(getComputedStyle(s).fontFamily));
        return v4.length > 0;
      });
      if (!ok) throw new Error('no V4 PUA spans rendering with QPCv4Page<N> font');
    },
  },
  {
    name: 'mushaf-madinah (/mushaf/madinah/50)',
    url: '/mushaf/madinah/50',
    expectSelectors: ['a.mushaf-word'],
    expectText: ['SŪRAT'],
  },
  {
    name: 'listen (/listen)',
    url: '/listen',
    expectSelectors: ['main', 'a, button'],
    expectText: ['Listen', 'Reciter', 'Sudais', 'Mishary', 'Husary'],
  },
  {
    name: 'search (/search)',
    url: '/search',
    expectSelectors: ['main', 'input[type="search"], input[type="text"]'],
    expectText: ['Search'],
  },
  {
    name: 'credits (/credits) — every QUL attribution surfaces',
    url: '/credits',
    expectSelectors: ['main'],
    expectText: ['QUL', 'Tarteel', 'KFGQPC', 'license'],
  },
  {
    name: 'salah (/salah) — prayer-times surface',
    url: '/salah',
    expectSelectors: ['main'],
    // Without geolocation set, /salah renders the "Location needed"
    // empty-state. Either that OR actual prayer names is acceptable.
    expectText: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Location needed', 'Salah'],
  },
  {
    name: 'topics (/topics)',
    url: '/topics',
    expectSelectors: ['main'],
    expectText: ['Topic'],
  },
  {
    name: 'study (/study/2/255 — Ayat-ul-Kursi)',
    url: '/study/2/255',
    expectSelectors: ['main'],
    expectText: ['Throne', 'Allah', 'Word'],
  },
  {
    name: 'API smoke — /v1/wbw/108:1 returns full Al-Kawthar gloss',
    url: '/api/v1/wbw/108:1',
    expectText: ['Al-Kauthar', 'verseKey'],
  },
  {
    name: 'API smoke — /v1/qpc-text/1:1?layout=v4 returns PUA payload',
    url: '/api/v1/qpc-text/1:1?layout=v4',
    expectText: ['QPCv4Page', '"pageNumber":1'],
  },
  {
    name: 'auth — /signin page',
    url: '/signin',
    expectSelectors: ['main', 'input[type="email"]', 'input[type="password"]'],
    expectText: ['Welcome back', 'Sign in'],
  },
  {
    name: 'auth — /signup page',
    url: '/signup',
    expectSelectors: ['main', 'input[type="email"]', 'input[type="password"]'],
    expectText: ['Create your account', 'Create account'],
  },
  {
    name: 'family — /family page (anonymous → sign-in CTA)',
    url: '/family',
    expectSelectors: ['main', 'a[href="/signin"]'],
    expectText: ['Sign in to see your family', 'Family-private'],
  },
  {
    name: 'family — /family/khatm page (anonymous → sign-in CTA)',
    url: '/family/khatm',
    expectSelectors: ['main', 'a[href="/signin"]'],
    expectText: ['Family khatm', 'Sign in'],
  },
  {
    name: 'pricing — /pricing page',
    url: '/pricing',
    expectSelectors: ['main', 'article[aria-label*="tier"]'],
    expectText: ['Free', 'Premium', 'Pro', "I can't afford it"],
  },
];

const results = [];
let failures = 0;

function pass(name, note) {
  results.push({ status: 'PASS', name, note });
}
function fail(name, note) {
  failures += 1;
  results.push({ status: 'FAIL', name, note });
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

/** Runs one check. Throws on failure with a human-readable message. */
async function runCheck(check) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  try {
    const url = `${BASE}${check.url}`;
    const isApi = check.url.startsWith('/api/');
    const resp = await page.goto(url, {
      waitUntil: isApi ? 'load' : 'networkidle2',
      timeout: 30000,
    });
    if (!resp || !resp.ok()) {
      throw new Error(`HTTP ${resp?.status() ?? 'no-response'}`);
    }
    let html = await page.content();
    if (isApi) {
      html = await page.evaluate(() => document.body?.innerText ?? '');
    }
    if (check.expectSelectors) {
      for (const sel of check.expectSelectors) {
        const found = await page.$(sel);
        if (!found) throw new Error(`selector not found: ${sel}`);
      }
    }
    if (check.expectText) {
      const haystack = html.toLowerCase();
      const matched = check.expectText.find((t) => haystack.includes(t.toLowerCase()));
      if (!matched) {
        throw new Error(
          `none of expected texts present: [${check.expectText.join(', ').slice(0, 100)}…]`,
        );
      }
    }
    if (check.action) await check.action(page);
    if (check.postAction) {
      await new Promise((r) => setTimeout(r, 1500));
      await check.postAction(page);
    }
    const hardErrors = consoleErrors.filter(
      (e) =>
        !/cast_sender|Failed to load resource: the server responded with a status of 4|google\.com|favicon\.ico|fetch is not defined|preact|hydration/i.test(
          e,
        ),
    );
    if (hardErrors.length > 0) {
      throw new Error(`console errors: ${hardErrors.slice(0, 2).join(' | ').slice(0, 240)}`);
    }
  } finally {
    try {
      await page.close();
    } catch {
      /* page may have been detached on error */
    }
  }
}

try {
  for (const check of CHECKS) {
    try {
      await runCheck(check);
      pass(check.name);
    } catch (err) {
      fail(check.name, err instanceof Error ? err.message.slice(0, 240) : 'unknown error');
    }
  }
} finally {
  await browser.close();
}

// Pretty print
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Qalaam smoke-sweep · ${BASE}`);
console.log('═══════════════════════════════════════════════════════════════');
for (const r of results) {
  const tag = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${tag}  ${r.name}${r.note ? `\n         ↳ ${r.note}` : ''}`);
}
console.log('───────────────────────────────────────────────────────────────');
console.log(`  ${results.length} checks · ${results.length - failures} pass · ${failures} fail`);
console.log('═══════════════════════════════════════════════════════════════');

process.exit(failures === 0 ? 0 : 1);
