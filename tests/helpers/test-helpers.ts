import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { DEFAULT_MEETING_CONFIG } from '../../src/types/common.js';
import type { Meeting } from '../../src/types/index.js';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * 创建测试用的插件 API mock。
 */
export function createMockApi(overrides?: Partial<OpenClawPluginApi>): OpenClawPluginApi {
  return {
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
    registerTool: () => {},
    registerCommand: () => {},
    getConfig: <T = unknown>() => ({}) as T,
    ...overrides,
  } as unknown as OpenClawPluginApi;
}

/**
 * 创建测试用的会议实体，避免每个测试重复拼装完整结构。
 */
export function createMeetingFixture(overrides?: Partial<Meeting>): Meeting {
  return {
    id: 'meeting_fixture_001',
    theme: '测试会议',
    purpose: '验证测试夹具',
    type: 'brainstorm',
    host_agent: 'meeting-plugin',
    participants: [
      {
        agent_id: 'host-agent',
        role: 'host',
        status: 'joined',
        speaking_count: 0,
      },
      {
        agent_id: 'participant-agent',
        role: 'participant',
        status: 'joined',
        speaking_count: 0,
      },
    ],
    agenda: [],
    status: 'created',
    current_agenda_index: 0,
    timing: {
      created_at: '2026-04-10T00:00:00.000Z',
      expected_duration: 60,
    },
    config: DEFAULT_MEETING_CONFIG,
    notes: [],
    voting_history: [],
    tasks: [],
    metadata: {
      session_id: 'session_fixture_001',
      user_id: 'user_fixture_001',
      agenda_confirmed: false,
    },
    ...overrides,
  };
}

/**
 * 创建按测试文件隔离的临时存储目录。
 */
export function createTestStorageDir(prefix: string): string {
  const baseDir = process.env.TEST_TMP_ROOT || 'D:/work/Temp';
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

/**
 * 解析工具返回的 JSON 文本，减少测试中的重复样板代码。
 */
export function parseToolResult<T>(result: ToolResult): T {
  return JSON.parse(result.content[0]?.text ?? '{}') as T;
}
