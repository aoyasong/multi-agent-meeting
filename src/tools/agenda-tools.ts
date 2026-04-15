/**
 * 议程管理工具
 * 
 * @module tools/agenda-tools
 */

import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { jsonResult } from '../utils/json-result.js';
import { generateAgendaId } from '../utils/id-generator.js';
import { loadMeeting, saveMeeting } from '../modules/meeting/storage.js';
import type { AgendaItem, AgendaItemStatus } from '../types/index.js';

// ==================== agenda_add_item ====================

export const AgendaAddItemToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  title: Type.String({ description: '议题标题' }),
  description: Type.Optional(Type.String({ description: '议题描述' })),
  expected_duration: Type.Number({ description: '预计时长（分钟）', minimum: 1 }),
  time_limit: Type.Optional(Type.Number({ description: '时间限制（分钟）' })),
  materials: Type.Optional(Type.Array(Type.String(), { description: '关联材料' })),
}, { additionalProperties: false });

export function createAgendaAddItemTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_add_item',
    label: 'Agenda Add Item',
    description: '添加议程项到会议',
    parameters: AgendaAddItemToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const meeting = await loadMeeting(meetingId);
        
        const newItem: AgendaItem = {
          id: generateAgendaId(),
          title: rawParams.title as string,
          expected_duration: rawParams.expected_duration as number,
          status: 'pending' as AgendaItemStatus,
          timing: {},
        };
        
        if (rawParams.description) newItem.description = rawParams.description as string;
        if (rawParams.time_limit) newItem.time_limit = rawParams.time_limit as number;
        if (rawParams.materials) newItem.materials = rawParams.materials as string[];

        // 议程有变动后，必须重新确认才能开始会议
        meeting.metadata.agenda_confirmed = false;
        meeting.metadata.agenda_confirmed_at = undefined;
        meeting.agenda.push(newItem);
        await saveMeeting(meeting);
        
        return jsonResult({
          agenda_item_id: newItem.id,
          index: meeting.agenda.length - 1,
          title: newItem.title,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to add agenda item: ${message}` });
      }
    },
  };
}

// ==================== agenda_list_items ====================

export const AgendaListItemsToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
}, { additionalProperties: false });

export function createAgendaListItemsTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_list_items',
    label: 'Agenda List Items',
    description: '列出会议的所有议程项',
    parameters: AgendaListItemsToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meeting = await loadMeeting(rawParams.meeting_id as string);
        
        return jsonResult({
          agenda_items: meeting.agenda.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description,
            expected_duration: item.expected_duration,
            status: item.status,
            started_at: item.timing.started_at,
            ended_at: item.timing.ended_at,
          })),
          current_index: meeting.current_agenda_index,
          agenda_confirmed: meeting.metadata.agenda_confirmed,
          agenda_confirmed_at: meeting.metadata.agenda_confirmed_at,
        });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to list agenda: ${message}` });
      }
    },
  };
}

// ==================== agenda_next_item ====================

export const AgendaNextItemToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
}, { additionalProperties: false });

export function createAgendaNextItemTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_next_item',
    label: 'Agenda Next Item',
    description: '切换到下一议程项并自动完成当前议程',
    parameters: AgendaNextItemToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const meeting = await loadMeeting(meetingId);
        
        const currentIndex = meeting.current_agenda_index;
        const currentItem = meeting.agenda[currentIndex];
        const nextIndex = currentIndex + 1;
        const nextItem = meeting.agenda[nextIndex];
        
        if (!nextItem) {
          return jsonResult({
            error: true,
            message: '已经是最后一个议程项',
            current_index: currentIndex,
            is_last: true,
          });
        }
        
        // 完成当前议程
        if (currentItem) {
          currentItem.status = 'completed';
          currentItem.timing.ended_at = new Date().toISOString();
        }
        
        // 激活下一议程
        nextItem.status = 'in_progress';
        nextItem.timing.started_at = new Date().toISOString();
        meeting.current_agenda_index = nextIndex;
        
        await saveMeeting(meeting);
        
        return jsonResult({
          previous_item: currentItem ? {
            id: currentItem.id,
            title: currentItem.title,
            status: 'completed',
          } : null,
          current_item: {
            id: nextItem.id,
            title: nextItem.title,
            status: 'in_progress',
          },
          is_last: nextIndex === meeting.agenda.length - 1,
          progress: `${nextIndex + 1}/${meeting.agenda.length}`,
        });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to switch agenda: ${message}` });
      }
    },
  };
}

// ==================== agenda_update_item ====================

export const AgendaUpdateItemToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agenda_item_id: Type.String({ description: '议程项ID' }),
  title: Type.Optional(Type.String({ description: '议题标题' })),
  description: Type.Optional(Type.String({ description: '议题描述' })),
  expected_duration: Type.Optional(Type.Number({ description: '预计时长（分钟）', minimum: 1 })),
  time_limit: Type.Optional(Type.Number({ description: '时间限制（分钟）', minimum: 1 })),
  materials: Type.Optional(Type.Array(Type.String(), { description: '关联材料' })),
}, { additionalProperties: false });

export function createAgendaUpdateItemTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_update_item',
    label: 'Agenda Update Item',
    description: '更新指定议程项内容',
    parameters: AgendaUpdateItemToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agendaItemId = rawParams.agenda_item_id as string;
        const meeting = await loadMeeting(meetingId);
        const item = meeting.agenda.find(a => a.id === agendaItemId);

        if (!item) {
          return jsonResult({ error: true, message: `Agenda item not found: ${agendaItemId}` });
        }

        if (rawParams.title !== undefined) item.title = rawParams.title as string;
        if (rawParams.description !== undefined) item.description = rawParams.description as string;
        if (rawParams.expected_duration !== undefined) item.expected_duration = rawParams.expected_duration as number;
        if (rawParams.time_limit !== undefined) item.time_limit = rawParams.time_limit as number;
        if (rawParams.materials !== undefined) item.materials = rawParams.materials as string[];

        meeting.metadata.agenda_confirmed = false;
        meeting.metadata.agenda_confirmed_at = undefined;
        await saveMeeting(meeting);

        return jsonResult({
          agenda_item_id: item.id,
          updated: true,
          agenda_confirmed: meeting.metadata.agenda_confirmed,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to update agenda item: ${message}` });
      }
    },
  };
}

// ==================== agenda_remove_item ====================

export const AgendaRemoveItemToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agenda_item_id: Type.String({ description: '议程项ID' }),
}, { additionalProperties: false });

export function createAgendaRemoveItemTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_remove_item',
    label: 'Agenda Remove Item',
    description: '删除指定议程项',
    parameters: AgendaRemoveItemToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agendaItemId = rawParams.agenda_item_id as string;
        const meeting = await loadMeeting(meetingId);

        const index = meeting.agenda.findIndex(a => a.id === agendaItemId);
        if (index < 0) {
          return jsonResult({ error: true, message: `Agenda item not found: ${agendaItemId}` });
        }

        const removed = meeting.agenda.splice(index, 1)[0];
        if (meeting.current_agenda_index >= meeting.agenda.length) {
          meeting.current_agenda_index = Math.max(0, meeting.agenda.length - 1);
        }

        meeting.metadata.agenda_confirmed = false;
        meeting.metadata.agenda_confirmed_at = undefined;
        await saveMeeting(meeting);

        return jsonResult({
          removed_agenda_item_id: removed.id,
          removed_title: removed.title,
          remaining: meeting.agenda.length,
          agenda_confirmed: meeting.metadata.agenda_confirmed,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to remove agenda item: ${message}` });
      }
    },
  };
}

// ==================== agenda_reorder_items ====================

export const AgendaReorderItemsToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  ordered_agenda_item_ids: Type.Array(Type.String({ description: '议程项ID' }), {
    description: '重排后的议程项ID顺序',
    minItems: 1,
  }),
}, { additionalProperties: false });

export function createAgendaReorderItemsTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_reorder_items',
    label: 'Agenda Reorder Items',
    description: '按指定顺序重排议程项',
    parameters: AgendaReorderItemsToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const orderedIds = rawParams.ordered_agenda_item_ids as string[];
        const meeting = await loadMeeting(meetingId);

        if (orderedIds.length !== meeting.agenda.length) {
          return jsonResult({
            error: true,
            message: 'ordered_agenda_item_ids length must equal agenda length',
          });
        }

        const map = new Map(meeting.agenda.map(item => [item.id, item] as const));
        const reordered: AgendaItem[] = [];

        for (const id of orderedIds) {
          const item = map.get(id);
          if (!item) {
            return jsonResult({ error: true, message: `Invalid agenda item id in order: ${id}` });
          }
          reordered.push(item);
        }

        meeting.agenda = reordered;
        meeting.current_agenda_index = 0;
        meeting.metadata.agenda_confirmed = false;
        meeting.metadata.agenda_confirmed_at = undefined;
        await saveMeeting(meeting);

        return jsonResult({
          reordered: true,
          agenda_order: meeting.agenda.map(item => ({ id: item.id, title: item.title })),
          agenda_confirmed: meeting.metadata.agenda_confirmed,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to reorder agenda items: ${message}` });
      }
    },
  };
}

// ==================== agenda_confirm ====================

export const AgendaConfirmToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
}, { additionalProperties: false });

export function createAgendaConfirmTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_confirm',
    label: 'Agenda Confirm',
    description: '确认当前议程，确认后才允许会议开始',
    parameters: AgendaConfirmToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const meeting = await loadMeeting(meetingId);

        if (meeting.agenda.length === 0) {
          return jsonResult({
            error: true,
            message: 'Cannot confirm empty agenda',
            meeting_id: meetingId,
          });
        }

        const now = new Date().toISOString();
        meeting.metadata.agenda_confirmed = true;
        meeting.metadata.agenda_confirmed_at = now;
        await saveMeeting(meeting);

        return jsonResult({
          meeting_id: meetingId,
          agenda_confirmed: true,
          agenda_confirmed_at: now,
          agenda_count: meeting.agenda.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to confirm agenda: ${message}` });
      }
    },
  };
}
