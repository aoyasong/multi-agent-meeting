import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// 导入所有工具
import { createMeetingCreateTool } from '../src/tools/meeting-create.js';
import { createMeetingStartTool } from '../src/tools/meeting-start.js';
import { createMeetingEndTool } from '../src/tools/meeting-end.js';
import { createMeetingGetTool } from '../src/tools/meeting-get.js';
import { createAgendaAddItemTool, createAgendaConfirmTool } from '../src/tools/agenda-tools.js';
import { createSpeakingRequestTool, createSpeakingGrantTool, createSpeakingReleaseTool } from '../src/tools/speaking-tools.js';
import { createVotingCreateTool, createVotingCastTool, createVotingEndTool } from '../src/tools/voting-tools.js';
import { createRecordingTakeNoteTool } from '../src/tools/recording-tools.js';
import { createOutputGenerateSummaryTool, createOutputExportTool } from '../src/tools/output-tools.js';
import { createMockApi } from './helpers/test-helpers.js';


// Mock API
const mockApi = createMockApi();

// 测试存储目录
const TEST_STORAGE_DIR = path.join(os.tmpdir(), 'meeting-integration-test-' + Date.now());

describe('Integration: Full Meeting Flow', () => {
  // 工具实例
  const createTool = createMeetingCreateTool(mockApi);
  const startTool = createMeetingStartTool(mockApi);
  const endTool = createMeetingEndTool(mockApi);
  const getTool = createMeetingGetTool(mockApi);
  const agendaAddTool = createAgendaAddItemTool(mockApi);
  const agendaConfirmTool = createAgendaConfirmTool(mockApi);
  const speakingRequestTool = createSpeakingRequestTool(mockApi);
  const speakingGrantTool = createSpeakingGrantTool(mockApi);
  const speakingReleaseTool = createSpeakingReleaseTool(mockApi);
  const votingCreateTool = createVotingCreateTool(mockApi);
  const votingCastTool = createVotingCastTool(mockApi);
  const votingEndTool = createVotingEndTool(mockApi);
  const recordTool = createRecordingTakeNoteTool(mockApi);
  const summaryTool = createOutputGenerateSummaryTool(mockApi);
  const exportTool = createOutputExportTool(mockApi);

  let meetingId: string;
  let agenda1Id: string;

  beforeEach(() => {
    process.env.MEETING_STORAGE_DIR = TEST_STORAGE_DIR;
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('should complete a full meeting lifecycle', async () => {
    // 1. 创建会议
    const createResult = await createTool.execute('test', {
      theme: '技术方案评审会',
      purpose: '评审用户中心架构方案',
      type: 'tech_review',
      expected_duration: 60,
      participants: [
        { agent_id: 'tech-lead', role: 'host' },
        { agent_id: 'dev-agent', role: 'participant' },
        { agent_id: 'qa-agent', role: 'participant' },
      ],
    });
    const createData = JSON.parse(createResult.content[0]?.text ?? '{}');
    meetingId = createData.meeting_id;
    
    expect(createData.status).toBe('created');
    console.log('[Step 1] Meeting created:', meetingId);

    // 2. 添加议程
    const agenda1Result = await agendaAddTool.execute('test', {
      meeting_id: meetingId,
      title: '架构方案介绍',
      expected_duration: 15,
    });
    const agenda1Data = JSON.parse(agenda1Result.content[0]?.text ?? '{}');
    agenda1Id = agenda1Data.agenda_item_id;
    expect(agenda1Id).toBeDefined();

    const agenda2Result = await agendaAddTool.execute('test', {
      meeting_id: meetingId,
      title: '技术评审讨论',
      expected_duration: 30,
    });
    expect(JSON.parse(agenda2Result.content[0]?.text ?? '{}').agenda_item_id).toBeDefined();

    const agenda3Result = await agendaAddTool.execute('test', {
      meeting_id: meetingId,
      title: '方案投票',
      expected_duration: 10,
    });
    expect(JSON.parse(agenda3Result.content[0]?.text ?? '{}').agenda_item_id).toBeDefined();
    
    console.log('[Step 2] Agenda items added');

    // 2.1 确认议程
    const confirmAgendaResult = await agendaConfirmTool.execute('test', { meeting_id: meetingId });
    const confirmAgendaData = JSON.parse(confirmAgendaResult.content[0]?.text ?? '{}');
    expect(confirmAgendaData.agenda_confirmed).toBe(true);

    // 3. 开始会议
    const startResult = await startTool.execute('test', { meeting_id: meetingId });
    const startData = JSON.parse(startResult.content[0]?.text ?? '{}');
    
    // 有议程时，会议状态会自动变为in_progress
    expect(['started', 'in_progress']).toContain(startData.status);
    console.log('[Step 3] Meeting started');

    // 4. 发言协调
    await speakingRequestTool.execute('test', {
      meeting_id: meetingId,
      agent_id: 'tech-lead',
      priority: 10,
    });

    const grantResult = await speakingGrantTool.execute('test', { meeting_id: meetingId });
    expect(JSON.parse(grantResult.content[0]?.text ?? '{}').agent_id).toBe('tech-lead');
    
    console.log('[Step 4] Speaking coordination works');

    // 5. 记录发言
    await recordTool.execute('test', {
      meeting_id: meetingId,
      record: {
        agent_id: 'tech-lead',
        agenda_item_id: agenda1Id,
        raw_content: '我介绍一下架构方案的主要设计思路...',
        timestamp: new Date().toISOString(),
      },
    });

    await speakingReleaseTool.execute('test', {
      meeting_id: meetingId,
      agent_id: 'tech-lead',
    });
    
    console.log('[Step 5] Speech recorded');

    // 6. 更多发言
    await speakingRequestTool.execute('test', { meeting_id: meetingId, agent_id: 'dev-agent' });
    await speakingGrantTool.execute('test', { meeting_id: meetingId });
    
    await recordTool.execute('test', {
      meeting_id: meetingId,
      record: {
        agent_id: 'dev-agent',
        agenda_item_id: agenda1Id,
        raw_content: '这个方案我赞成，设计很合理',
        timestamp: new Date().toISOString(),
      },
    });

    await speakingReleaseTool.execute('test', {
      meeting_id: meetingId,
      agent_id: 'dev-agent',
    });

    await speakingRequestTool.execute('test', { meeting_id: meetingId, agent_id: 'qa-agent' });
    await speakingGrantTool.execute('test', { meeting_id: meetingId });
    
    await recordTool.execute('test', {
      meeting_id: meetingId,
      record: {
        agent_id: 'qa-agent',
        agenda_item_id: agenda1Id,
        raw_content: '后续需要根据这个方案制定测试计划',
        timestamp: new Date().toISOString(),
      },
    });

    await speakingReleaseTool.execute('test', {
      meeting_id: meetingId,
      agent_id: 'qa-agent',
    });
    
    console.log('[Step 6] More speeches recorded');

    // 7. 创建投票
    const votingResult = await votingCreateTool.execute('test', {
      meeting_id: meetingId,
      topic: '是否通过该架构方案',
      options: ['通过', '不通过', '需要修改后复审'],
      type: 'simple',
      window_type: 'simple',
    });
    const votingData = JSON.parse(votingResult.content[0]?.text ?? '{}');
    const votingId = votingData.voting_id;
    
    expect(votingId).toBeDefined();
    console.log('[Step 7] Voting created');

    // 8. 投票
    await votingCastTool.execute('test', {
      meeting_id: meetingId,
      voting_id: votingId,
      agent_id: 'tech-lead',
      option_id: 'opt_1',
    });

    await votingCastTool.execute('test', {
      meeting_id: meetingId,
      voting_id: votingId,
      agent_id: 'dev-agent',
      option_id: 'opt_1',
    });

    await votingCastTool.execute('test', {
      meeting_id: meetingId,
      voting_id: votingId,
      agent_id: 'qa-agent',
      option_id: 'opt_1',
    });
    
    console.log('[Step 8] All votes cast');

    // 9. 结束投票
    const endVotingResult = await votingEndTool.execute('test', {
      meeting_id: meetingId,
      voting_id: votingId,
    });
    const endVotingData = JSON.parse(endVotingResult.content[0]?.text ?? '{}');
    
    expect(endVotingData.result.winner_text).toBe('通过');
    console.log('[Step 9] Voting ended');

    // 10. 生成纪要
    const summaryResult = await summaryTool.execute('test', { meeting_id: meetingId });
    const summaryData = JSON.parse(summaryResult.content[0]?.text ?? '{}');
    
    expect(summaryData.success).toBe(true);
    expect(summaryData.summary.decisions_count).toBe(1);
    console.log('[Step 10] Summary generated');

    // 11. 导出
    const exportResult = await exportTool.execute('test', {
      meeting_id: meetingId,
      format: 'markdown',
      content: ['summary', 'transcript', 'actions'],
    });
    const exportData = JSON.parse(exportResult.content[0]?.text ?? '{}');
    
    expect(exportData.success).toBe(true);
    expect(exportData.files).toHaveLength(3);
    console.log('[Step 11] Exported to markdown');

    // 12. 结束会议
    const endResult = await endTool.execute('test', { meeting_id: meetingId });
    const endData = JSON.parse(endResult.content[0]?.text ?? '{}');
    
    expect(endData.status).toBe('ended');
    expect(endData.actual_duration).toBeDefined();
    console.log('[Step 12] Meeting ended');

    // 最终验证
    const getResult = await getTool.execute('test', { meeting_id: meetingId });
    const getData = JSON.parse(getResult.content[0]?.text ?? '{}');
    
    expect(getData.status).toBe('ended');
    expect(getData.statistics.notes_count).toBe(3);
    expect(getData.statistics.voting_count).toBe(1);
    
    console.log('[Integration] Full meeting lifecycle completed');
  }, 30000);

  it('should handle meeting with multiple agenda items', async () => {
    // 创建会议
    const createResult = await createTool.execute('test', {
      theme: '需求评审会',
      purpose: '评审迭代需求',
      type: 'requirement_review',
      expected_duration: 90,
      participants: [
        { agent_id: 'pm-agent', role: 'host' },
        { agent_id: 'dev-agent', role: 'participant' },
      ],
    });
    const meetingId = JSON.parse(createResult.content[0]?.text ?? '{}').meeting_id;

    // 添加多个议程
    for (let i = 1; i <= 5; i++) {
      await agendaAddTool.execute('test', {
        meeting_id: meetingId,
        title: `需求${i}`,
        expected_duration: 15,
      });
    }

    await agendaConfirmTool.execute('test', { meeting_id: meetingId });

    // 开始会议
    await startTool.execute('test', { meeting_id: meetingId });

    // 验证第一个议程已激活
    const getResult = await getTool.execute('test', { meeting_id: meetingId });
    const getData = JSON.parse(getResult.content[0]?.text ?? '{}');
    
    expect(getData.agenda[0].status).toBe('in_progress');
    expect(getData.current_agenda_index).toBe(0);

    console.log('[Integration] Multi-agenda test passed');
  });
});
