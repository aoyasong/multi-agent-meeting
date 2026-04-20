import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMeetingCreateTool } from '../src/tools/meeting-create.js';
import { createMockApi, createTestStorageDir } from './helpers/test-helpers.js';
import * as fs from 'fs/promises';

// Mock API
const mockApi = createMockApi();
const TEST_STORAGE_DIR = createTestStorageDir('meeting-create-test');

describe('meeting_create tool', () => {
  const tool = createMeetingCreateTool(mockApi);

  beforeEach(() => {
    process.env.MEETING_STORAGE_DIR = TEST_STORAGE_DIR;
  });

  afterEach(async () => {
    delete process.env.MEETING_STORAGE_DIR;
    await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
  });

  it('should have correct name', () => {
    expect(tool.name).toBe('meeting_create');
  });

  it('should create a meeting with valid parameters', async () => {
    const params = {
      theme: '测试会议',
      purpose: '验证会议创建功能',
      type: 'brainstorm',
      expected_duration: 30,
      participants: [
        { agent_id: 'agent-1', role: 'participant' as const },
        { agent_id: 'agent-2', role: 'participant' as const },
      ],
    };

    const result = await tool.execute('test-call-id', params);
    
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    
    const data = JSON.parse(result.content[0].text);
    expect(data.meeting_id).toBeDefined();
    expect(data.meeting_id).toMatch(/^meeting_/);
    expect(data.status).toBe('created');
    expect(data.theme).toBe('测试会议');
    expect(data.type).toBe('brainstorm');
    expect(data.participants_count).toBe(2);
  });

  it('should create a meeting with materials', async () => {
    const params = {
      theme: '需求评审会议',
      purpose: '评审用户中心需求',
      type: 'requirement_review' as const,
      expected_duration: 60,
      participants: [
        { agent_id: 'pm-agent', role: 'host' as const },
        { agent_id: 'dev-agent', role: 'participant' as const },
      ],
      materials: ['PRD文档链接', '原型图链接'],
    };

    const result = await tool.execute('test-call-id', params);
    const data = JSON.parse(result.content[0].text);
    
    expect(data.status).toBe('created');
    expect(data.type).toBe('requirement_review');
  });

  it('should validate meeting type', async () => {
    const params = {
      theme: '技术评审',
      purpose: '架构方案评审',
      type: 'tech_review' as const,
      expected_duration: 45,
      participants: [
        { agent_id: 'tech-lead', role: 'host' as const },
        { agent_id: 'arch-agent', role: 'participant' as const },
      ],
    };

    const result = await tool.execute('test-call-id', params);
    const data = JSON.parse(result.content[0].text);
    
    expect(data.type).toBe('tech_review');
  });
});
