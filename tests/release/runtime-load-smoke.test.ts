import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as url from 'url';

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { createMockApi } from '../helpers/test-helpers.js';

interface ToolDefinition {
  name: string;
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
  }>;
}

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..', '..');

describe('Runtime load smoke (dist)', () => {
  let storageDir: string;

  beforeEach(() => {
    storageDir = path.join(os.tmpdir(), `meeting-runtime-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    process.env.MEETING_STORAGE_DIR = storageDir;
  });

  afterEach(async () => {
    delete process.env.MEETING_STORAGE_DIR;
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('should load dist plugin entry and register all tools', async () => {
    const registerTool: OpenClawPluginApi['registerTool'] = vi.fn();
    const registerCommand = vi.fn();
    const api = createMockApi({
      registerTool,
      registerCommand,
    });

    const distEntryPath = path.resolve(pluginRoot, 'dist', 'index.js');
    await expect(fs.access(distEntryPath)).resolves.toBeUndefined();

    const loaded = await import(distEntryPath);
    const pluginEntry = loaded.default as { register: (api: OpenClawPluginApi) => void };

    expect(pluginEntry).toBeDefined();
    expect(typeof pluginEntry.register).toBe('function');

    pluginEntry.register(api);

    expect(registerTool).toHaveBeenCalledTimes(32);
    expect(registerCommand).toHaveBeenCalledTimes(5);
  });

  it('should execute meeting_create from dist and return a meeting id', async () => {
    const tools: ToolDefinition[] = [];
    const api = createMockApi({
      registerTool: tool => {
        tools.push(tool as ToolDefinition);
      },
    });

    const distEntryPath = path.resolve(pluginRoot, 'dist', 'index.js');
    const loaded = await import(distEntryPath);
    const pluginEntry = loaded.default as { register: (api: OpenClawPluginApi) => void };
    pluginEntry.register(api);

    const meetingCreateTool = tools.find(tool => tool.name === 'meeting_create');
    expect(meetingCreateTool).toBeDefined();

    const result = await meetingCreateTool!.execute('smoke-test', {
      theme: '发布前烟雾测试',
      purpose: '验证dist可执行',
      type: 'brainstorm',
      expected_duration: 30,
      participants: [{ agent_id: 'agent-release', role: 'participant' }],
    });
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as { meeting_id?: string; status?: string };

    expect(parsed.meeting_id).toMatch(/^meeting_/);
    expect(parsed.status).toBe('created');
  });
});
