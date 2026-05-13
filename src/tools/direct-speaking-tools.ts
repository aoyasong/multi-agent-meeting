/**
 * 主持人主动调度工具 - 直接发言调度
 * 
 * @module tools/direct-speaking-tools
 */
import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { jsonResult } from '../utils/json-result.js';
import { loadMeeting, saveMeeting } from '../modules/meeting/storage.js';

function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ==================== speaking_invite ====================

export const SpeakingInviteToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  target_agent_id: Type.String({ description: '被邀请发言的 Agent ID' }),
  topic: Type.Optional(Type.String({ description: '邀请发言的主题/话题' })),
  context: Type.Optional(Type.String({ description: '背景上下文说明' })),
}, { additionalProperties: false });

export function createSpeakingInviteTool(_api: OpenClawPluginApi) {
  return {
    name: 'speaking_invite',
    label: 'Speaking Invite',
    description: '主持人主动点名邀请特定Agent针对指定主题发言，直接授予发言权',
    parameters: SpeakingInviteToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const targetAgentId = rawParams.target_agent_id as string;
        const topic = rawParams.topic as string | undefined;
        const context = rawParams.context as string | undefined;

        const meeting = await loadMeeting(meetingId);

        const participant = meeting.participants.find(p => p.agent_id === targetAgentId);
        if (!participant) {
          return jsonResult({
            error: true,
            message: `Agent not found in meeting: ${targetAgentId}`,
          });
        }

        if (!meeting.speaking_state) {
          meeting.speaking_state = { queue: [] };
        }

        meeting.speaking_state.current_speaker = targetAgentId;
        meeting.speaking_state.granted_at = new Date().toISOString();

        const currentAgenda = meeting.agenda[meeting.current_agenda_index];
        if (currentAgenda) {
          if (!currentAgenda.invited_agent_ids.includes(targetAgentId)) {
            currentAgenda.invited_agent_ids.push(targetAgentId);
          }
        }

        await saveMeeting(meeting);

        return jsonResult({
          invited_agent_id: targetAgentId,
          topic: topic,
          context: context,
          granted_at: meeting.speaking_state.granted_at,
          speaking_rights_granted: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to invite speaking: ${message}` });
      }
    },
  };
}

// ==================== speaking_raise_question ====================

export const SpeakingRaiseQuestionToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  target_agent_id: Type.String({ description: '定向接收问题的目标 Agent ID' }),
  question_content: Type.String({ description: '问题的具体内容' }),
  reference_agenda_item_id: Type.Optional(Type.String({ description: '关联的议题ID' })),
}, { additionalProperties: false });

export function createSpeakingRaiseQuestionTool(_api: OpenClawPluginApi) {
  return {
    name: 'speaking_raise_question',
    label: 'Speaking Raise Question',
    description: '主持人向特定Agent定向抛出问题，要求该Agent针对性答疑',
    parameters: SpeakingRaiseQuestionToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const targetAgentId = rawParams.target_agent_id as string;
        const questionContent = rawParams.question_content as string;
        const referenceAgendaItemId = rawParams.reference_agenda_item_id as string | undefined;

        const meeting = await loadMeeting(meetingId);

        const participant = meeting.participants.find(p => p.agent_id === targetAgentId);
        if (!participant) {
          return jsonResult({
            error: true,
            message: `Target agent not found in meeting: ${targetAgentId}`,
          });
        }

        if (referenceAgendaItemId) {
          const agendaItem = meeting.agenda.find(a => a.id === referenceAgendaItemId);
          if (agendaItem) {
            agendaItem.unresolved_questions.push(questionContent);
          }
        } else {
          const currentAgenda = meeting.agenda[meeting.current_agenda_index];
          if (currentAgenda) {
            currentAgenda.unresolved_questions.push(questionContent);
          }
        }

        await saveMeeting(meeting);

        return jsonResult({
          question_id: generateShortId(),
          target_agent_id: targetAgentId,
          question_content: questionContent,
          reference_agenda_item_id: referenceAgendaItemId,
          created_at: new Date().toISOString(),
          question_recorded: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to raise question: ${message}` });
      }
    },
  };
}

// ==================== speaking_pause_topic ====================

export const SpeakingPauseTopicToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  reason: Type.String({ description: '临时暂停当前议题的原因' }),
  next_agenda_index: Type.Optional(Type.Number({ description: '指定立即切到的下一个议程索引，不指定则保留当前位置' })),
}, { additionalProperties: false });

export function createSpeakingPauseTopicTool(_api: OpenClawPluginApi) {
  return {
    name: 'speaking_pause_topic',
    label: 'Speaking Pause Topic',
    description: '临时暂停当前议题讨论，可以指定立即跳转到其他议程，避免会议阻塞',
    parameters: SpeakingPauseTopicToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const reason = rawParams.reason as string;
        const nextAgendaIndex = rawParams.next_agenda_index as number | undefined;

        const meeting = await loadMeeting(meetingId);

        const currentAgenda = meeting.agenda[meeting.current_agenda_index];
        if (currentAgenda) {
          currentAgenda.status = 'blocked';
          currentAgenda.blocked_reason = reason;
        }

        if (nextAgendaIndex !== undefined && nextAgendaIndex >= 0 && nextAgendaIndex < meeting.agenda.length) {
          meeting.current_agenda_index = nextAgendaIndex;
          const newCurrentAgenda = meeting.agenda[nextAgendaIndex];
          if (newCurrentAgenda && newCurrentAgenda.status === 'pending') {
            newCurrentAgenda.status = 'discussing';
            newCurrentAgenda.timing.started_at = new Date().toISOString();
          }
        }

        await saveMeeting(meeting);

        return jsonResult({
          paused: true,
          paused_agenda_index: meeting.current_agenda_index,
          reason: reason,
          new_agenda_index: nextAgendaIndex,
          meeting_continued: nextAgendaIndex !== undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to pause topic: ${message}` });
      }
    },
  };
}
