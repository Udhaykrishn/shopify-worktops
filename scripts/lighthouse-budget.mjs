export const STORE = 'mi-task-store.myshopify.com';
export const BUDGETS = Object.freeze({ performance: 0.9, lcp: 2500, cls: 0.1 });

export function allowedURL(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.hash || (!local && (url.hostname !== STORE || url.protocol !== 'https:'))) {
    throw new Error('Audit target must be the Mi-Task development store or a local preview.');
  }
  if (local && !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid local preview protocol.');
  return url;
}

export function checkReport(report, requestedURL) {
  const issues = [];
  const expected = allowedURL(requestedURL);
  if (report.runtimeError) issues.push(`Lighthouse failed: ${report.runtimeError.code}`);
  const actual = new URL(report.finalDisplayedUrl || report.finalUrl || report.requestedUrl);
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.searchParams.get('view') !== expected.searchParams.get('view')) {
    issues.push(`Unexpected audited page: ${actual.origin}${actual.pathname}`);
  }
  const metrics = {
    performance: report.categories?.performance?.score,
    lcp: report.audits?.['largest-contentful-paint']?.numericValue,
    cls: report.audits?.['cumulative-layout-shift']?.numericValue,
  };
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) issues.push(`Missing valid ${key} measurement`);
  }
  if (typeof metrics.performance === 'number' && metrics.performance <= BUDGETS.performance) issues.push('Performance must be above 90.');
  if (typeof metrics.lcp === 'number' && metrics.lcp >= BUDGETS.lcp) issues.push('LCP must be below 2500 ms.');
  if (typeof metrics.cls === 'number' && metrics.cls >= BUDGETS.cls) issues.push('CLS must be below 0.1.');
  return { metrics, issues };
}

export function verifyPage({ status, url, title, passwordForm, challenge, themeId, h1Count }, requestedURL, expectedThemeId) {
  const expected = allowedURL(requestedURL);
  const actual = new URL(url);
  if (status !== 200 || actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.searchParams.get('view') !== expected.searchParams.get('view')) {
    throw new Error(`Expected storefront page returned status ${status} or redirected to ${actual.pathname}.`);
  }
  if (passwordForm || challenge || /just a moment|access denied|verify you are human/i.test(title)) {
    throw new Error('Password or bot challenge page cannot count as a storefront performance result.');
  }
  if (h1Count !== 1) throw new Error(`Expected one H1, found ${h1Count}.`);
  if (expectedThemeId && String(themeId) !== String(expectedThemeId)) {
    throw new Error('Rendered theme ID does not match the theme uploaded for this commit.');
  }
}

export function median(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
