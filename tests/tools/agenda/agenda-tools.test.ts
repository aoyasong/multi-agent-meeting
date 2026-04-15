import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';

import { loadMeeting, saveMeeting } from '../../../src/modules/meeting/storage.js';
import {
  createAgendaAddItemTool,
  createAgendaConfirmTool,
  createAgendaListItemsTool,
  createAgendaNextItemTool,
  createAgendaRemoveItemTool,
  createAgendaReorderItemsTool,
  createAgendaUpdateItemTool,
} from '../../../src/tools/agenda-tools.js';
import { createMeetingFixture, createMockApi, createTestStorageDir, parseToolResult } from '../../helpers/test-helpers.js';

describe('Agenda tools', () => {
  let storageDir: string;
  let meetingId: string;

  beforeEach(async () => {
    storageDir = createTestStorageDir('meeting-agenda-test');
    process.env.MEETING_STORAGE_DIR = storageDir;
    meetingId = 'meeting_agenda_001';

    await saveMeeting(createMeetingFixture({
      id: meetingId,
      agenda: [],
    }));
  });

  afterEach(async () => {
    delete process.env.MEETING_STORAGE_DIR;
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('should add agenda items with optional fields and list them', async () => {
    const api = createMockApi();
    const addTool = createAgendaAddItemTool(api);
    const listTool = createAgendaListItemsTool(api);

    const added = parseToolResult<{ agenda_item_id: string; index: number; title: string }>(
      await addTool.execute('test', {
        meeting_id: meetingId,
        title: '架构方案评审',
        description: '评审用户中心架构',
        expected_duration: 20,
        time_limit: 25,
        materials: ['prd', 'design'],
      })
    );

    expect(added.agenda_item_id).toMatch(/^agenda_/);
    expect(added.index).toBe(0);
    expect(added.title).toBe('架构方案评审');

    const listed = parseToolResult<{
      agenda_items: Array<{
        id: string;
        title: string;
        description?: string;
        expected_duration: number;
        status: string;
      }>;
      current_index: number;
      agenda_confirmed: boolean;
    }>(await listTool.execute('test', { meeting_id: meetingId }));

    expect(listed.current_index).toBe(0);
    expect(listed.agenda_items).toHaveLength(1);
    expect(listed.agenda_items[0]?.id).toBe(added.agenda_item_id);
    expect(listed.agenda_items[0]?.description).toBe('评审用户中心架构');
    expect(listed.agenda_items[0]?.expected_duration).toBe(20);
    expect(listed.agenda_items[0]?.status).toBe('pending');
    expect(listed.agenda_confirmed).toBe(false);

    const meeting = await loadMeeting(meetingId);
    expect(meeting.agenda[0]?.materials).toEqual(['prd', 'design']);
    expect(meeting.agenda[0]?.time_limit).toBe(25);
  });

  it('should update, reorder, confirm and remove agenda items', async () => {
    const api = createMockApi();
    const addTool = createAgendaAddItemTool(api);
    const updateTool = createAgendaUpdateItemTool(api);
    const reorderTool = createAgendaReorderItemsTool(api);
    const confirmTool = createAgendaConfirmTool(api);
    const removeTool = createAgendaRemoveItemTool(api);

    const first = parseToolResult<{ agenda_item_id: string }>(await addTool.execute('test', {
      meeting_id: meetingId,
      title: '议程一',
      expected_duration: 10,
    }));
    const second = parseToolResult<{ agenda_item_id: string }>(await addTool.execute('test', {
      meeting_id: meetingId,
      title: '议程二',
      expected_duration: 20,
    }));

    const updated = parseToolResult<{ agenda_item_id: string; updated: boolean }>(
      await updateTool.execute('test', {
        meeting_id: meetingId,
        agenda_item_id: first.agenda_item_id,
        description: '更新后的描述',
        expected_duration: 15,
      })
    );
    expect(updated.updated).toBe(true);

    const reordered = parseToolResult<{ reordered: boolean; agenda_order: Array<{ id: string }> }>(
      await reorderTool.execute('test', {
        meeting_id: meetingId,
        ordered_agenda_item_ids: [second.agenda_item_id, first.agenda_item_id],
      })
    );
    expect(reordered.reordered).toBe(true);
    expect(reordered.agenda_order[0]?.id).toBe(second.agenda_item_id);

    const confirmed = parseToolResult<{ agenda_confirmed: boolean }>(
      await confirmTool.execute('test', { meeting_id: meetingId })
    );
    expect(confirmed.agenda_confirmed).toBe(true);

    const removed = parseToolResult<{ remaining: number; removed_agenda_item_id: string }>(
      await removeTool.execute('test', {
        meeting_id: meetingId,
        agenda_item_id: second.agenda_item_id,
      })
    );
    expect(removed.removed_agenda_item_id).toBe(second.agenda_item_id);
    expect(removed.remaining).toBe(1);

    const meeting = await loadMeeting(meetingId);
    expect(meeting.metadata.agenda_confirmed).toBe(false);
  });

  it('should switch to next agenda item and complete the previous one', async () => {
    const meeting = createMeetingFixture({
      id: meetingId,
      status: 'in_progress',
      current_agenda_index: 0,
      agenda: [
        {
          id: 'agenda_1',
          title: '议程一',
          expected_duration: 10,
          status: 'in_progress',
          timing: { started_at: '2026-04-10T09:00:00.000Z' },
        },
        {
          id: 'agenda_2',
          title: '议程二',
          expected_duration: 10,
          status: 'pending',
          timing: {},
        },
      ],
    });
    await saveMeeting(meeting);

    const nextTool = createAgendaNextItemTool(createMockApi());
    const result = parseToolResult<{
      previous_item: { id: string; status: string } | null;
      current_item: { id: string; status: string };
      is_last: boolean;
      progress: string;
    }>(await nextTool.execute('test', { meeting_id: meetingId }));

    expect(result.previous_item?.id).toBe('agenda_1');
    expect(result.previous_item?.status).toBe('completed');
    expect(result.current_item.id).toBe('agenda_2');
    expect(result.current_item.status).toBe('in_progress');
    expect(result.is_last).toBe(true);
    expect(result.progress).toBe('2/2');

    const updated = await loadMeeting(meetingId);
    expect(updated.current_agenda_index).toBe(1);
    expect(updated.agenda[0]?.status).toBe('completed');
    expect(updated.agenda[0]?.timing.ended_at).toBeDefined();
    expect(updated.agenda[1]?.status).toBe('in_progress');
    expect(updated.agenda[1]?.timing.started_at).toBeDefined();
  });

  it('should return a readable error when already at the last agenda item', async () => {
    const meeting = createMeetingFixture({
      id: meetingId,
      current_agenda_index: 0,
      agenda: [
        {
          id: 'agenda_last',
          title: '最后议程',
          expected_duration: 10,
          status: 'pending',
          timing: {},
        },
      ],
    });
    await saveMeeting(meeting);

    const nextTool = createAgendaNextItemTool(createMockApi());
    const result = parseToolResult<{ error?: boolean; message?: string; is_last?: boolean; current_index?: number }>(
      await nextTool.execute('test', { meeting_id: meetingId })
    );

    expect(result.error).toBe(true);
    expect(result.message).toBe('已经是最后一个议程项');
    expect(result.is_last).toBe(true);
    expect(result.current_index).toBe(0);
  });
});
