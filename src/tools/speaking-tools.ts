/**
 * 发言协调工具
 * 
 * @module tools/speaking-tools
 */
import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { jsonResult } from '../utils/json-result.js';
import { loadMeeting, saveMeeting } from '../modules/meeting/storage.js';
import type { SpeakingQueueItem } from '../types/index.js';

function ensureSpeakingStateInitialized(meeting: { speaking_state?: { current_speaker?: string; queue: SpeakingQueueItem[]; granted_at?: string } }) {
  if (!meeting.speaking_state) {
    meeting.speaking_state = {
      queue: [],
    };
  }
  if (!meeting.speaking_state.queue) {
    meeting.speaking_state.queue = [];
  }
}

// ==================== speaking_request ====================

export const SpeakingRequestToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agent_id: Type.String({ description: '请求发言的Agent ID' }),
  topic: Type.Optional(Type.String({ description: '发言主题' })),
  priority: Type.Optional(Type.Number({ description: '优先级', minimum: 0, maximum: 10 })),
}, { additionalProperties: false });

export function createSpeakingRequestTool(_api: OpenClawPluginApi) {
  return {
    name: 'speaking_request',
    label: 'Speaking Request',
    description: 'Agent请求发言权并加入发言队列',
    parameters: SpeakingRequestToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agentId = rawParams.agent_id as string;
        const topic = rawParams.topic as string | undefined;
        const priority = (rawParams.priority as number) ?? 5;

        const meeting = await loadMeeting(meetingId);
        ensureSpeakingStateInitialized(meeting);
        const state = meeting.speaking_state!;

        const existingIndex = state.queue.findIndex(q => q.agent_id === agentId);
        if (existingIndex >= 0) {
          return jsonResult({
            error: true,
            message: 'Agent already in queue',
            queue_position: existingIndex + 1,
            current_speaker: state.current_speaker ?? null,
            queue_length: state.queue.length,
          });
        }

        const queueItem: SpeakingQueueItem = {
          agent_id: agentId,
          requested_at: new Date().toISOString(),
          priority,
          topic,
        };
        state.queue.push(queueItem);
        state.queue.sort((a, b) => b.priority - a.priority);

        await saveMeeting(meeting);

        const position = state.queue.findIndex(q => q.agent_id === agentId) + 1;
        const estimatedWait = position * 30;

        return jsonResult({
          queue_position: position,
          estimated_wait_seconds: estimatedWait,
          current_speaker: state.current_speaker ?? null,
          queue_length: state.queue.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to request speaking: ${message}` });
      }
    },
  };
}

// ==================== speaking_grant ====================

export const SpeakingGrantToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agent_id: Type.Optional(Type.String({ description: '指定授予的Agent ID，不指定则按队列顺序' })),
}, { additionalProperties: false });

export function createSpeakingGrantTool(_api: OpenClawPluginApi) {
  return {
    name: 'speaking_grant',
    label: 'Speaking Grant',
    description: '授予发言权给下一个Agent或指定Agent',
    parameters: SpeakingGrantToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const specifiedAgentId = rawParams.agent_id as string | undefined;

        const meeting = await loadMeeting(meetingId);
        ensureSpeakingStateInitialized(meeting);
        const state = meeting.speaking_state!;

        let targetAgentId: string | undefined;
        if (specifiedAgentId) {
          targetAgentId = specifiedAgentId;
          state.queue = state.queue.filter(q => q.agent_id !== specifiedAgentId);
        } else if (state.queue.length > 0) {
          const nextItem = state.queue.shift();
          targetAgentId = nextItem?.agent_id;
        }

        if (!targetAgentId) {
          return jsonResult({
            error: true,
            message: 'No agent to grant speaking to',
          });
        }

        state.current_speaker = targetAgentId;
        state.granted_at = new Date().toISOString();

        await saveMeeting(meeting);

        return jsonResult({
          agent_id: targetAgentId,
          granted_at: state.granted_at,
          queue_remaining: state.queue.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to grant speaking: ${message}` });
      }
    },
  };
}

// ==================== speaking_release ====================

export const SpeakingReleaseToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agent_id: Type.String({ description: '释放发言权的Agent ID' }),
}, { additionalProperties: false });

export function createSpeakingReleaseTool(_api: OpenClawPluginApi) {
  return {
    name: 'speaking_release',
    label: 'Speaking Release',
    description: 'Agent释放发言权并返回队列状态',
    parameters: SpeakingReleaseToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agentId = rawParams.agent_id as string;

        const meeting = await loadMeeting(meetingId);
        ensureSpeakingStateInitialized(meeting);
        const state = meeting.speaking_state!;

        if (!state.current_speaker || state.current_speaker !== agentId) {
          return jsonResult({
            error: true,
            message: 'Agent does not have speaking rights',
          });
        }

        state.current_speaker = undefined;
        state.granted_at = undefined;

        const participant = meeting.participants.find(p => p.agent_id === agentId);
        if (participant) {
          participant.speaking_count++;
          participant.last_active_at = new Date().toISOString();
        }

        await saveMeeting(meeting);

        return jsonResult({
          released: true,
          agent_id: agentId,
          next_speaker: state.queue[0]?.agent_id ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to release speaking: ${message}` });
      }
    },
  };
}

// ==================== speaking_status ====================

export const SpeakingStatusToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
}, { additionalProperties: false });

export function createSpeakingStatusTool(_api: OpenClawPluginApi) {
  return {
    name: 'speaking_status',
    label: 'Speaking Status',
    description: '查看当前发言状态和队列',
    parameters: SpeakingStatusToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const meeting = await loadMeeting(meetingId);
        ensureSpeakingStateInitialized(meeting);
        const state = meeting.speaking_state!;

        return jsonResult({
          current_speaker: state.current_speaker ?? null,
          queue: state.queue.map(q => ({
            agent_id: q.agent_id,
            priority: q.priority,
            topic: q.topic,
            requested_at: q.requested_at,
          })),
          granted_at: state.granted_at ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to get status: ${message}` });
      }
    },
  };
}
