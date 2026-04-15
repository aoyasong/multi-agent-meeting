/**
 * 会议开始工具
 * 
 * @module tools/meeting-start
 */

import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { jsonResult } from '../utils/json-result.js';
import { loadMeeting, saveMeeting, updateMeetingIndex } from '../modules/meeting/storage.js';

/**
 * 会议开始工具参数Schema
 */
export const MeetingStartToolSchema = Type.Object({
  meeting_id: Type.String({ 
    description: '会议ID' 
  }),
}, { 
  additionalProperties: false 
});

/**
 * 创建会议开始工具
 */
export function createMeetingStartTool(_api: OpenClawPluginApi) {
  return {
    name: 'meeting_start',
    label: 'Meeting Start',
    description: '开始会议并激活状态；如有议程则激活首个议程项',
    parameters: MeetingStartToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        
        // 加载会议
        const meeting = await loadMeeting(meetingId);
        
        // 状态校验
        if (meeting.status !== 'created') {
          return jsonResult({
            error: true,
            message: `Cannot start meeting with status: ${meeting.status}`,
            meeting_id: meetingId,
            current_status: meeting.status,
          });
        }

        if (!meeting.metadata.agenda_confirmed) {
          return jsonResult({
            error: true,
            message: 'Agenda must be confirmed before meeting_start',
            meeting_id: meetingId,
            agenda_confirmed: false,
          });
        }
        
        // 更新状态
        const now = new Date().toISOString();
        meeting.status = 'started';
        meeting.timing.started_at = now;
        
        // 更新参与者状态
        for (const p of meeting.participants) {
          p.status = 'joined';
          p.joined_at = now;
        }
        
        // 如果有议程，激活第一项
        let firstAgendaItem = null;
        if (meeting.agenda.length > 0) {
          firstAgendaItem = meeting.agenda[0];
          if (firstAgendaItem) {
            firstAgendaItem.status = 'in_progress';
            firstAgendaItem.timing.started_at = now;
            meeting.status = 'in_progress';
          }
        }
        
        // 持久化
        await saveMeeting(meeting);
        await updateMeetingIndex(meetingId, meeting);
        
        // 返回结果
        return jsonResult({
          meeting_id: meeting.id,
          status: meeting.status,
          started_at: meeting.timing.started_at,
          first_agenda_item: firstAgendaItem ? {
            id: firstAgendaItem.id,
            title: firstAgendaItem.title,
            status: firstAgendaItem.status,
          } : null,
          participants_count: meeting.participants.length,
          agenda_count: meeting.agenda.length,
        });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({
          error: true,
          message: `Failed to start meeting: ${message}`,
        });
      }
    },
  };
}
