import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedURL, checkReport, median, verifyPage } from './lighthouse-budget.mjs';

const url = 'https://mi-task-store.myshopify.com/products/concrete-white-quartz?preview_theme_id=123';
const report = (performance = 0.8, lcp = 2499, cls = 0.099) => ({
  finalDisplayedUrl: url,
  categories: { performance: { score: performance } },
  audits: {
    'largest-contentful-paint': { numericValue: lcp },
    'cumulative-layout-shift': { numericValue: cls },
  },
});
const page = { status: 200, url, title: 'Quartz Worktop', passwordForm: false, challenge: false, themeId: 123, h1Count: 1 };

test('assignment boundaries: score is inclusive, LCP and CLS are strict', () => {
  assert.deepEqual(checkReport(report(), url).issues, []);
  assert.equal(checkReport(report(0.79, 2500, 0.1), url).issues.length, 3);
});

test('missing or nonnumeric data and runtime errors cannot pass budgets', () => {
  const invalid = report(null, null, NaN);
  invalid.runtimeError = { code: 'NO_FCP' };
  assert.equal(checkReport(invalid, url).issues.length, 4);
});

test('a password, challenge, error, redirect, wrong theme, or missing H1 cannot pass preflight', () => {
  verifyPage(page, url, 123);
  for (const change of [
    { passwordForm: true }, { challenge: true }, { status: 404 },
    { url: 'https://mi-task-store.myshopify.com/password' },
    { themeId: 999 }, { h1Count: 0 }, { h1Count: 2 },
  ]) assert.throws(() => verifyPage({ ...page, ...change }, url, 123));
  assert.ok(checkReport({ ...report(), finalDisplayedUrl: 'https://mi-task-store.myshopify.com/password' }, url).issues.length);
});

test('audit target cannot escape the agreed development store', () => {
  for (const value of ['https://work-tops.com/', 'https://mi-task-store.myshopify.com.evil.test/', 'http://mi-task-store.myshopify.com/', 'https://token@mi-task-store.myshopify.com/']) {
    assert.throws(() => allowedURL(value));
  }
  assert.equal(allowedURL('http://127.0.0.1:9292/').port, '9292');
});

test('median is stable under one fast or slow outlier', () => {
  assert.equal(median([2000, 9000, 1800]), 2000);
});

test('stress template cannot silently fall back to the regular homepage', () => {
  const requested = 'https://mi-task-store.myshopify.com/?view=assessment';
  assert.throws(() => verifyPage({ ...page, url: 'https://mi-task-store.myshopify.com/' }, requested));
  assert.ok(checkReport({ ...report(), finalDisplayedUrl: 'https://mi-task-store.myshopify.com/' }, requested).issues.length);
});
