import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { allowedURL, BUDGETS, checkReport, median, STORE, verifyPage } from './lighthouse-budget.mjs';

const output = path.resolve(process.env.LIGHTHOUSE_OUTPUT_DIR || '.lighthouseci');
const runs = Number(process.env.LIGHTHOUSE_RUNS || 3);
if (![1, 3, 5].includes(runs)) throw new Error('LIGHTHOUSE_RUNS must be 1, 3, or 5. CI uses 3.');
await mkdir(output, { recursive: true });

const manifest = process.env.THEME_MANIFEST ? JSON.parse(await readFile(process.env.THEME_MANIFEST, 'utf8')) : null;
const base = allowedURL(manifest?.previewUrl || process.env.LIGHTHOUSE_BASE_URL || `https://${STORE}/`);
const expectedThemeId = manifest?.themeId || base.searchParams.get('preview_theme_id');
if (expectedThemeId) {
  // Shopify's official CI action excludes the editor preview bar and redirect, while retaining storefront scripts.
  base.searchParams.set('_fd', '0');
  base.searchParams.set('pb', '0');
}
const paths = ['/', process.env.LIGHTHOUSE_PRODUCT_PATH || '/products/concrete-white-quartz', process.env.LIGHTHOUSE_COLLECTION_PATH || '/collections/quartz-worktops'];
paths.push(process.env.LIGHTHOUSE_STRESS_PATH || '/?view=assessment');
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
if (manifest && (manifest.sourceSha !== sourceSha || dirty)) throw new Error('Audit checkout differs from the uploaded clean source commit.');
const summary = {
  label: process.env.LIGHTHOUSE_LABEL || 'current',
  createdAt: new Date().toISOString(),
  sourceSha, localChanges: dirty,
  sourceAssociation: manifest ? 'uploaded-clean-commit' : 'remote-storefront-not-proven-to-match-local-source',
  themeId: expectedThemeId || null,
  origin: base.origin, runsPerPage: runs, budgets: BUDGETS,
  method: 'Lighthouse default mobile simulated throttling; every run must pass all three budgets.',
  pages: [], errors: [],
};

let chrome;
let browser;
try {
  if (process.env.CHROME_PATH) await access(process.env.CHROME_PATH);
  chrome = await launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'] });
  browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  const page = await browser.newPage();
  const session = await page.createCDPSession();
  await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true });
  for (const pagePath of paths) {
    if (!pagePath.startsWith('/') || pagePath.startsWith('//')) throw new Error('Audit paths must be relative storefront paths.');
    const target = new URL(pagePath, base);
    for (const [key, value] of base.searchParams) target.searchParams.set(key, value);
    allowedURL(target);
    const pageName = target.pathname === '/' ? 'home' : target.pathname.slice(1).replaceAll(/[^a-z0-9-]/gi, '-');
    const name = target.searchParams.has('view') ? `${pageName}-${target.searchParams.get('view').replaceAll(/[^a-z0-9-]/gi, '-')}` : pageName;
    const result = { path: `${target.pathname}${target.searchParams.has('view') ? `?view=${target.searchParams.get('view')}` : ''}`, requestedUrl: target.href, runs: [], issues: [] };
    summary.pages.push(result);
    try {
      let response = await page.goto(target.href, { waitUntil: 'networkidle2', timeout: 60000 });
      if (await page.$('form[action="/password"] input[name="password"]')) {
        if (!process.env.SHOPIFY_STORE_PASSWORD) throw new Error('Set SHOPIFY_STORE_PASSWORD for the password-protected development storefront.');
        await page.type('input[name="password"]', process.env.SHOPIFY_STORE_PASSWORD);
        await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.$eval('form[action="/password"]', (form) => form.submit())]);
        response = await page.goto(target.href, { waitUntil: 'networkidle2', timeout: 60000 });
      }
      const inspect = async () => page.evaluate(() => ({
        url: location.href, title: document.title,
        passwordForm: Boolean(document.querySelector('form[action="/password"] input[name="password"]')),
        challenge: Boolean(document.querySelector('#challenge-form, #shopify-challenge, .shopify-challenge__container, #cf-challenge-running')),
        themeId: window.Shopify?.theme?.id,
        h1Count: document.querySelectorAll('h1').length,
      }));
      const before = { status: response.status(), ...await inspect() };
      verifyPage(before, target, expectedThemeId);
      result.renderedThemeId = before.themeId || null;
      // The preflight tab must not run a second copy of storefront scripts during the measured navigation.
      await page.goto('about:blank');
      for (let run = 1; run <= runs; run++) {
        console.log(`Mobile audit ${name}, run ${run}/${runs}`);
        // Keep storefront authentication cookies while measuring a cold HTTP cache.
        await session.send('Network.clearBrowserCache');
        const audit = await lighthouse(target.href, {
          port: chrome.port, logLevel: 'error', output: ['html', 'json'],
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
          formFactor: 'mobile', disableStorageReset: true,
        });
        const filename = `${name}-${run}`;
        await writeFile(path.join(output, `${filename}.html`), audit.report[0]);
        await writeFile(path.join(output, `${filename}.json`), audit.report[1]);
        const checked = checkReport(audit.lhr, target);
        result.runs.push({ run, ...checked.metrics, issues: checked.issues, html: `${filename}.html`, json: `${filename}.json` });
        result.issues.push(...checked.issues.map((issue) => `Run ${run}: ${issue}`));
      }
      response = await page.goto(target.href, { waitUntil: 'networkidle2', timeout: 60000 });
      verifyPage({ status: response.status(), ...await inspect() }, target, expectedThemeId);
      result.median = Object.fromEntries(['performance', 'lcp', 'cls'].map((metric) => [metric, median(result.runs.map((run) => run[metric]))]));
    } catch (error) {
      result.issues.push(error.message);
    }
  }
} catch (error) {
  summary.errors.push(error.message);
} finally {
  await browser?.disconnect();
  await chrome?.kill();
}

summary.passed = !summary.errors.length && summary.pages.length === paths.length && summary.pages.every((page) => page.runs.length === runs && !page.issues.length);
await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
const lines = [
  `## Mobile Lighthouse: ${summary.passed ? 'PASS' : 'FAIL'}`,
  `Commit: \`${sourceSha}\` · Theme: \`${summary.themeId || 'unverified source'}\` · ${runs} runs per page`,
  `Source association: ${summary.sourceAssociation}. Local changes: ${dirty}.`,
  'Budgets: performance >90, LCP <2500 ms, CLS <0.1. Every run must pass; medians are descriptive.',
  '', '| Page | Median performance | Median LCP (ms) | Median CLS | Result |', '|---|---:|---:|---:|---|',
  ...summary.pages.map((page) => `| ${page.path} | ${page.median ? Math.round(page.median.performance * 100) : '—'} | ${page.median ? Math.round(page.median.lcp) : '—'} | ${page.median?.cls?.toFixed(3) ?? '—'} | ${page.issues.length ? 'FAIL' : 'PASS'} |`),
  '', ...summary.errors.map((error) => `- ${error}`),
  ...summary.pages.flatMap((page) => page.issues.map((issue) => `- ${page.path}: ${issue}`)),
  '', 'HTML and JSON reports are retained even when a budget fails. These are lab measurements, not field Core Web Vitals.',
];
const markdown = `${lines.join('\n')}\n`;
await writeFile(path.join(output, 'summary.md'), markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
if (!summary.passed) process.exitCode = 1;
