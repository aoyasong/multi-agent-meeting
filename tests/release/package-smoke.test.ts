import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as url from 'url';

import manifest from '../../openclaw.plugin.json';
import pkg from '../../package.json';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..', '..');

describe('Release package smoke', () => {
  it('should keep package entry and openclaw extension consistent with dist output', async () => {
    const mainEntry = pkg.main;
    const extensionEntry = pkg.openclaw?.extensions?.[0];

    expect(typeof mainEntry).toBe('string');
    expect(typeof extensionEntry).toBe('string');
    expect(mainEntry).toBe('./dist/index.js');
    expect(extensionEntry).toBe('./dist/index.js');

    const distEntryPath = path.resolve(pluginRoot, 'dist', 'index.js');
    await expect(fs.access(distEntryPath)).resolves.toBeUndefined();
  });

  it('should include required publish files and a non-empty tools contract', async () => {
    expect(Array.isArray(pkg.files)).toBe(true);
    expect(pkg.files).toContain('dist');
    expect(pkg.files).toContain('openclaw.plugin.json');

    const manifestPath = path.resolve(pluginRoot, 'openclaw.plugin.json');
    await expect(fs.access(manifestPath)).resolves.toBeUndefined();

    expect(manifest.id).toBe('multi-agent-meeting-plugin');
    expect(Array.isArray(manifest.contracts?.tools)).toBe(true);
    expect((manifest.contracts?.tools ?? []).length).toBe(33);
  });
});
