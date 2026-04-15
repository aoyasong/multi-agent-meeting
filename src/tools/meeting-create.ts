/**
 * 会议创建工具
 * 
 * @module tools/meeting-create
 */

import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { jsonResult } from '../utils/json-result.js';
import { generateMeetingId } from '../utils/id-generator.js';
import { saveMeeting, updateMeetingIndex } from '../modules/meeting/storage.js';
import { DEFAULT_MEETING_CONFIG } from '../types/common.js';
import type { Meeting, MeetingType, Participant, ParticipantRole, ParticipantStatus, MeetingMetadata } from '../types/index.js';

/**
 * 会议创建工具参数Schema
 */
export const MeetingCreateToolSchema = Type.Object({
  theme: Type.String({ 
    description: '会议主题' 
  }),
  purpose: Type.String({ 
    description: '会议目的' 
  }),
  type: Type.Union([
    Type.Literal('brainstorm'),
    Type.Literal('requirement_review'),
    Type.Literal('tech_review'),
    Type.Literal('project_kickoff'),
  ], {
    description: '会议类型: brainstorm, requirement_review, tech_review, project_kickoff'
  }),
  expected_duration: Type.Number({ 
    description: '预计时长（分钟）', 
    minimum: 5, 
    maximum: 240 
  }),
  participants: Type.Array(Type.Object({
    agent_id: Type.String({ description: 'Agent标识' }),
    role: Type.Union([
      Type.Literal('host'),
      Type.Literal('participant'),
      Type.Literal('observer'),
    ], { description: '角色: host, participant, observer' }),
  }), { 
    description: '参与者列表',
    minItems: 1 
  }),
  materials: Type.Optional(Type.Array(Type.String(), { 
    description: '关联材料（可选）' 
  })),
}, { 
  additionalProperties: false 
});

/**
 * 参与者输入类型
 */
interface ParticipantInput {
  agent_id: string;
  role: ParticipantRole;
}

/**
 * 创建会议创建工具
 */
export function createMeetingCreateTool(_api: OpenClawPluginApi) {
  return {
    name: 'meeting_create',
    label: 'Meeting Create',
    description: '创建会议实例并返回会议ID与基础信息',
    parameters: MeetingCreateToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        // 解析参数
        const theme = rawParams.theme as string;
        const purpose = rawParams.purpose as string;
        const type = rawParams.type as MeetingType;
        const expectedDuration = rawParams.expected_duration as number;
        const participantsInput = rawParams.participants as ParticipantInput[];
        const materials = rawParams.materials as string[] | undefined;
        
        // 生成会议ID
        const meetingId = generateMeetingId();
        
        // 构建参与者列表
        const participants: Participant[] = participantsInput.map(p => ({
          agent_id: p.agent_id,
          role: p.role,
          status: 'invited' as ParticipantStatus,
          speaking_count: 0,
        }));
        
        // 构建会议实体
        const metadata: MeetingMetadata = {
          session_id: '', // 将在 start 时创建
          user_id: '', // 从api获取
          agenda_confirmed: false,
        };
        if (materials) {
          metadata.materials = materials;
        }
        
        const meeting: Meeting = {
          id: meetingId,
          theme,
          purpose,
          type,
          host_agent: 'meeting-plugin', // Plugin作为主Agent
          participants,
          agenda: [],
          status: 'created',
          current_agenda_index: 0,
          timing: {
            created_at: new Date().toISOString(),
            expected_duration: expectedDuration,
          },
          config: DEFAULT_MEETING_CONFIG,
          notes: [],
          voting_history: [],
          tasks: [],
          metadata,
        };
        
        // 持久化
        await saveMeeting(meeting);
        await updateMeetingIndex(meetingId, meeting);
        
        // 返回结果
        return jsonResult({
          meeting_id: meetingId,
          status: 'created',
          created_at: meeting.timing.created_at,
          theme: meeting.theme,
          type: meeting.type,
          expected_duration: meeting.timing.expected_duration,
          participants_count: participants.length,
        });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({
          error: true,
          message: `Failed to create meeting: ${message}`,
        });
      }
    },
  };
}
