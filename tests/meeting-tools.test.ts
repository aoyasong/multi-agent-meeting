import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMeetingCreateTool } from '../src/tools/meeting-create.js';
import { createMeetingStartTool } from '../src/tools/meeting-start.js';
import { createMeetingStartReadinessTool } from '../src/tools/meeting-start-readiness.js';
import { createMeetingEndTool } from '../src/tools/meeting-end.js';
import { createMeetingGetTool } from '../src/tools/meeting-get.js';
import { createMeetingListTool } from '../src/tools/meeting-list.js';
import { createAgendaAddItemTool, createAgendaConfirmTool } from '../src/tools/agenda-tools.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createMockApi } from './helpers/test-helpers.js';

// Mock API
const mockApi = createMockApi();

// 测试数据目录
const TEST_STORAGE_DIR = path.join(os.tmpdir(), 'meeting-test-' + Date.now());

describe('Meeting Tools', () => {
  const createTool = createMeetingCreateTool(mockApi);
  const startTool = createMeetingStartTool(mockApi);
  const readinessTool = createMeetingStartReadinessTool(mockApi);
  const endTool = createMeetingEndTool(mockApi);
  const getTool = createMeetingGetTool(mockApi);
  const listTool = createMeetingListTool(mockApi);
  const agendaAddTool = createAgendaAddItemTool(mockApi);
  const agendaConfirmTool = createAgendaConfirmTool(mockApi);

  beforeEach(async () => {
    // 设置测试存储目录
    process.env.MEETING_STORAGE_DIR = TEST_STORAGE_DIR;
  });

  afterEach(async () => {
    // 清理测试数据
    try {
      await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('meeting_create', () => {
    it('should create a meeting', async () => {
      const params = {
        theme: '测试会议',
        purpose: '验证功能',
        type: 'brainstorm',
        expected_duration: 30,
        participants: [
          { agent_id: 'agent-1', role: 'participant' as const },
          { agent_id: 'agent-2', role: 'participant' as const },
        ],
      };

      const result = await createTool.execute('test', params);
      const data = JSON.parse(result.content[0]?.text ?? '{}');
      
      expect(data.meeting_id).toBeDefined();
      expect(data.status).toBe('created');
    });
  });

  describe('meeting lifecycle', () => {
    it('should start and end a meeting', async () => {
      // 创建会议
      const createResult = await createTool.execute('test', {
        theme: '生命周期测试',
        purpose: '测试完整流程',
        type: 'tech_review',
        expected_duration: 60,
        participants: [
          { agent_id: 'dev-agent', role: 'host' as const },
          { agent_id: 'qa-agent', role: 'participant' as const },
        ],
      });
      const createData = JSON.parse(createResult.content[0]?.text ?? '{}');
      const meetingId = createData.meeting_id;

      await agendaAddTool.execute('test', {
        meeting_id: meetingId,
        title: '议程一',
        expected_duration: 20,
      });
      await agendaConfirmTool.execute('test', { meeting_id: meetingId });

      // 开始会议
      const startResult = await startTool.execute('test', { meeting_id: meetingId });
      const startData = JSON.parse(startResult.content[0]?.text ?? '{}');
      
      expect(['started', 'in_progress']).toContain(startData.status);
      expect(startData.started_at).toBeDefined();

      // 结束会议
      const endResult = await endTool.execute('test', { meeting_id: meetingId });
      const endData = JSON.parse(endResult.content[0]?.text ?? '{}');
      
      expect(endData.status).toBe('ended');
      expect(endData.actual_duration).toBeDefined();
    });

    it('should not start an already started meeting', async () => {
      // 创建会议
      const createResult = await createTool.execute('test', {
        theme: '重复开始测试',
        purpose: '测试状态校验',
        type: 'brainstorm',
        expected_duration: 30,
        participants: [
          { agent_id: 'agent-1', role: 'participant' as const },
          { agent_id: 'agent-2', role: 'participant' as const },
        ],
      });
      const createData = JSON.parse(createResult.content[0]?.text ?? '{}');
      const meetingId = createData.meeting_id;

      await agendaAddTool.execute('test', {
        meeting_id: meetingId,
        title: '议程一',
        expected_duration: 10,
      });
      await agendaConfirmTool.execute('test', { meeting_id: meetingId });

      // 第一次开始
      await startTool.execute('test', { meeting_id: meetingId });

      // 第二次开始应该失败
      const secondStart = await startTool.execute('test', { meeting_id: meetingId });
      const secondData = JSON.parse(secondStart.content[0]?.text ?? '{}');
      
      expect(secondData.error).toBe(true);
    });
  });

  describe('meeting queries', () => {
    it('should get meeting details', async () => {
      // 创建会议
      const createResult = await createTool.execute('test', {
        theme: '查询测试',
        purpose: '测试查询功能',
        type: 'requirement_review',
        expected_duration: 45,
        participants: [
          { agent_id: 'pm-agent', role: 'host' as const },
          { agent_id: 'dev-agent', role: 'participant' as const },
        ],
      });
      const createData = JSON.parse(createResult.content[0]?.text ?? '{}');
      const meetingId = createData.meeting_id;

      // 查询会议
      const getResult = await getTool.execute('test', { meeting_id: meetingId });
      const getData = JSON.parse(getResult.content[0]?.text ?? '{}');
      
      expect(getData.id).toBe(meetingId);
      expect(getData.theme).toBe('查询测试');
      expect(getData.type).toBe('requirement_review');
    });

    it('should list meetings', async () => {
      // 创建多个会议
      for (let i = 0; i < 3; i++) {
        await createTool.execute('test', {
          theme: `会议${i + 1}`,
          purpose: '测试列表',
          type: 'brainstorm',
          expected_duration: 30,
          participants: [
            { agent_id: 'agent-1', role: 'participant' as const },
            { agent_id: 'agent-2', role: 'participant' as const },
          ],
        });
      }

      // 查询列表
      const listResult = await listTool.execute('test', { limit: 10 });
      const listData = JSON.parse(listResult.content[0]?.text ?? '{}');
      
      expect(listData.meetings.length).toBeGreaterThanOrEqual(3);
      expect(listData.pagination.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe('readiness checks', () => {
    it('should return readiness blockers before agenda confirmation', async () => {
      const createResult = await createTool.execute('test', {
        theme: '就绪性检查',
        purpose: '测试启动前校验',
        type: 'project_kickoff',
        expected_duration: 30,
        participants: [
          { agent_id: 'agent-a', role: 'host' as const },
          { agent_id: 'agent-b', role: 'participant' as const },
        ],
      });
      const createData = JSON.parse(createResult.content[0]?.text ?? '{}');
      const meetingId = createData.meeting_id;

      const readinessResult = await readinessTool.execute('test', { meeting_id: meetingId });
      const readinessData = JSON.parse(readinessResult.content[0]?.text ?? '{}');

      expect(readinessData.can_start).toBe(false);
      expect(Array.isArray(readinessData.blockers)).toBe(true);
      expect(readinessData.blockers.length).toBeGreaterThan(0);
    });

  });
});
