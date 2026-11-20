import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORE, allowedURL } from './lighthouse-budget.mjs';

export function verifyCreatedTheme(theme, expectedName) {
  const id = String(theme?.id || '');
  if (!/^\d+$/.test(id) || theme.role !== 'unpublished' || theme.name !== expectedName || theme.shop !== STORE) {
    throw new Error('Shopify did not return the expected newly created unpublished development-store theme.');
  }
  const preview = allowedURL(theme.preview_url);
  if (preview.hostname !== STORE || preview.searchParams.get('preview_theme_id') !== id) {
    throw new Error('Preview URL does not identify the newly uploaded theme.');
  }
  return { themeId: id, themeName: expectedName, previewUrl: preview.href };
}

export function verifyCleanup(theme, manifest) {
  if (!theme || String(theme.id) !== manifest.themeId || theme.name !== manifest.themeName || theme.role !== 'unpublished' || !/^ci-\d+-\d+-[a-f0-9]{12}$/.test(theme.name)) {
    throw new Error('Cleanup refused: theme ID, unique CI name, or unpublished role no longer matches.');
  }
}

export function cliEnvironment(environment) {
  return Object.fromEntries(Object.entries(environment).filter(([key]) => !key.startsWith('SHOPIFY_FLAG_')));
}

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.SHOPIFY_CI_ENABLED !== 'true') {
    throw new Error('Preview uploads are disabled. After approving CI uploads, set repository variable SHOPIFY_CI_ENABLED=true.');
  }
  if (!process.env.SHOPIFY_CLI_THEME_TOKEN) throw new Error('Missing GitHub secret SHOPIFY_CLI_THEME_TOKEN (Theme Access password).');
  const manifestPath = path.resolve(process.env.THEME_MANIFEST || '.lighthouseci/theme-manifest.json');
  const shopify = path.resolve('node_modules/.bin/shopify');
  const command = (args) => {
    try {
      return execFileSync(shopify, ['theme', ...args, '--store', STORE], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...cliEnvironment(process.env), CI: 'true', SHOPIFY_CLI_NO_ANALYTICS: '1' },
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      // Credentials stay in the environment, never command arguments or saved reports.
      let message = String(error.stderr || error.message);
      for (const secret of [process.env.SHOPIFY_CLI_THEME_TOKEN, process.env.SHOPIFY_STORE_PASSWORD]) {
        if (secret) message = message.replaceAll(secret, '[REDACTED]');
      }
      throw new Error(`Shopify CLI failed: ${message}`);
    }
  };
  if (process.argv[2] === 'create') {
    const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('CI must upload a clean checked-out commit.');
    if (!/^\d+$/.test(process.env.GITHUB_RUN_ID || '') || !/^\d+$/.test(process.env.GITHUB_RUN_ATTEMPT || '')) throw new Error('Missing GitHub run identity.');
    const themeName = `ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-${sourceSha.slice(0, 12)}`;
    // The required checks job already runs Theme Check; --strict prefixes stdout with a second JSON document.
    const pushed = JSON.parse(command(['push', '--unpublished', '--theme', themeName, '--json']));
    const manifest = { ...verifyCreatedTheme(pushed.theme, themeName), store: STORE, sourceSha, uploadedAt: new Date().toISOString() };
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Uploaded commit ${sourceSha} to unpublished CI theme ${manifest.themeId}.`);
  } else if (process.argv[2] === 'delete') {
    let manifest;
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) {
      if (error.code === 'ENOENT') { console.log('No successfully created CI theme to clean up.'); return; }
      throw error;
    }
    if (manifest.store !== STORE) throw new Error('Cleanup refused: manifest store mismatch.');
    const themes = JSON.parse(command(['list', '--id', manifest.themeId, '--json']));
    const theme = themes.find((item) => String(item.id) === manifest.themeId);
    verifyCleanup(theme, manifest);
    command(['delete', '--theme', manifest.themeId, '--force']);
    console.log(`Deleted only CI theme ${manifest.themeId}. Reports retain its commit association.`);
  } else throw new Error('Usage: node scripts/preview-theme.mjs create|delete');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
