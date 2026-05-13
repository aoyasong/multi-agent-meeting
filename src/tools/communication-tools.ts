/**
 * 跨Agent消息桥接工具
 * 
 * @module tools/communication-tools
 */
import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { jsonResult } from '../utils/json-result.js';
import { loadMeeting, saveMeeting } from '../modules/meeting/storage.js';
import type { InterAgentMessage } from '../types/index.js';

function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ==================== communication_relay_message ====================

export const CommunicationRelayMessageToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  from_agent_id: Type.String({ description: '发消息的源 Agent ID' }),
  to_agent_id: Type.String({ description: '接收消息的目标 Agent ID' }),
  content: Type.String({ description: '消息的完整内容' }),
  reference_agenda_item_id: Type.Optional(Type.String({ description: '关联的议题ID' })),
}, { additionalProperties: false });

export function createCommunicationRelayMessageTool(_api: OpenClawPluginApi) {
  return {
    name: 'communication_relay_message',
    label: 'Communication Relay Message',
    description: '主持人安全中转 Agent 之间的关键提问与答疑，记录消息到会议全量上下文',
    parameters: CommunicationRelayMessageToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const fromAgentId = rawParams.from_agent_id as string;
        const toAgentId = rawParams.to_agent_id as string;
        const content = rawParams.content as string;
        const referenceAgendaItemId = rawParams.reference_agenda_item_id as string | undefined;

        const meeting = await loadMeeting(meetingId);

        const senderExists = meeting.participants.some(p => p.agent_id === fromAgentId);
        const receiverExists = meeting.participants.some(p => p.agent_id === toAgentId);

        if (!senderExists) {
          return jsonResult({ error: true, message: `Sender agent not found in meeting: ${fromAgentId}` });
        }
        if (!receiverExists) {
          return jsonResult({ error: true, message: `Receiver agent not found in meeting: ${toAgentId}` });
        }

        if (!('inter_agent_messages' in meeting)) {
          (meeting as any).inter_agent_messages = [];
        }

        const newMessage: InterAgentMessage = {
          id: generateShortId(),
          meeting_id: meetingId,
          from_agent_id: fromAgentId,
          to_agent_id: toAgentId,
          content: content,
          reference_agenda_item_id: referenceAgendaItemId,
          created_at: new Date().toISOString(),
          is_resolved: false,
        };

        ((meeting as any).inter_agent_messages as InterAgentMessage[]).push(newMessage);
        await saveMeeting(meeting);

        return jsonResult({
          message_id: newMessage.id,
          from_agent_id: fromAgentId,
          to_agent_id: toAgentId,
          content: content,
          created_at: newMessage.created_at,
          message_relayed: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to relay message: ${message}` });
      }
    },
  };
}

// ==================== communication_list_unresolved_questions ====================

export const CommunicationListUnresolvedQuestionsToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
}, { additionalProperties: false });

export function createCommunicationListUnresolvedQuestionsTool(_api: OpenClawPluginApi) {
  return {
    name: 'communication_list_unresolved_questions',
    label: 'Communication List Unresolved Questions',
    description: '列出当前会议所有悬而未决、还未得到回复的跨Agent问题消息',
    parameters: CommunicationListUnresolvedQuestionsToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const meeting = await loadMeeting(meetingId);

        const messages = ('inter_agent_messages' in meeting) 
          ? ((meeting as any).inter_agent_messages as InterAgentMessage[]) 
          : [];
        
        const unresolved = messages.filter(m => !m.is_resolved);

        return jsonResult({
          meeting_id: meetingId,
          total_unresolved: unresolved.length,
          unresolved_questions: unresolved.map(m => ({
            message_id: m.id,
            from_agent_id: m.from_agent_id,
            to_agent_id: m.to_agent_id,
            content: m.content,
            reference_agenda_item_id: m.reference_agenda_item_id,
            created_at: m.created_at,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to list unresolved questions: ${message}` });
      }
    },
  };
}

// ==================== agenda_generate_context_snapshot ====================

export const AgendaGenerateContextSnapshotToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agenda_item_id: Type.String({ description: '要生成快照的议题ID' }),
}, { additionalProperties: false });

export function createAgendaGenerateContextSnapshotTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_generate_context_snapshot',
    label: 'Agenda Generate Context Snapshot',
    description: '为指定当前议题生成精简的上下文快照，便于新Agent快速了解该议题背景，避免重复解释',
    parameters: AgendaGenerateContextSnapshotToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agendaItemId = rawParams.agenda_item_id as string;

        const meeting = await loadMeeting(meetingId);
        const agendaItem = meeting.agenda.find(a => a.id === agendaItemId);

        if (!agendaItem) {
          return jsonResult({ error: true, message: `Agenda item not found: ${agendaItemId}` });
        }

        const snapshot = {
          agenda_item_id: agendaItem.id,
          title: agendaItem.title,
          description: agendaItem.description,
          status: agendaItem.status,
          discussion_round: agendaItem.discussion_round,
          consensus_proposal: agendaItem.consensus_proposal,
          unresolved_questions: agendaItem.unresolved_questions,
          invited_agents: agendaItem.invited_agent_ids,
          escalated_to_user: agendaItem.escalated_to_user,
        };

        return jsonResult({
          meeting_id: meetingId,
          agenda_item_id: agendaItemId,
          context_snapshot: snapshot,
          snapshot_generated_at: new Date().toISOString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to generate context snapshot: ${message}` });
      }
    },
  };
}
