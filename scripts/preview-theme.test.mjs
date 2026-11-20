import assert from 'node:assert/strict';
import test from 'node:test';
import { cliEnvironment, verifyCreatedTheme, verifyCleanup } from './preview-theme.mjs';

const name = 'ci-123-1-abcdef123456';
const theme = { id: 456, name, role: 'unpublished', shop: 'mi-task-store.myshopify.com', preview_url: 'https://mi-task-store.myshopify.com/?preview_theme_id=456' };

test('uploaded theme must match exact store, fresh name, unpublished role and preview ID', () => {
  assert.equal(verifyCreatedTheme(theme, name).themeId, '456');
  for (const change of [
    { role: 'main' }, { role: 'live' }, { name: 'Dawn' },
    { shop: 'work-tops.com' }, { preview_url: 'https://mi-task-store.myshopify.com/?preview_theme_id=999' },
  ]) assert.throws(() => verifyCreatedTheme({ ...theme, ...change }, name));
});

test('cleanup cannot delete a published, renamed, unrelated or mismatched theme', () => {
  const manifest = { themeId: '456', themeName: name };
  verifyCleanup(theme, manifest);
  for (const change of [{ role: 'main' }, { role: 'live' }, { name: 'Dawn' }, { id: 999 }]) {
    assert.throws(() => verifyCleanup({ ...theme, ...change }, manifest));
  }
  assert.throws(() => verifyCleanup(undefined, manifest));
});

test('inherited CLI deploy flags cannot publish or redirect a CI upload', () => {
  assert.deepEqual(cliEnvironment({ SHOPIFY_FLAG_PUBLISH: 'true', SHOPIFY_FLAG_LIVE: 'true', SHOPIFY_CLI_THEME_TOKEN: 'secret', PATH: '/bin' }), { SHOPIFY_CLI_THEME_TOKEN: 'secret', PATH: '/bin' });
});
