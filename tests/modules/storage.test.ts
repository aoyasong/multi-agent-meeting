import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deleteMeeting,
  listMeetings,
  loadMeeting,
  meetingExists,
  saveMeeting,
  updateMeetingIndex,
} from '../../src/modules/meeting/storage.js';
import { createMeetingFixture, createTestStorageDir } from '../helpers/test-helpers.js';

describe('Meeting storage module', () => {
  let storageDir: string;

  beforeEach(() => {
    storageDir = createTestStorageDir('meeting-storage-test');
    process.env.MEETING_STORAGE_DIR = storageDir;
  });

  afterEach(async () => {
    delete process.env.MEETING_STORAGE_DIR;
  });

  it('should save and load meeting metadata', async () => {
    const meeting = createMeetingFixture({
      id: 'meeting_storage_save_load',
      theme: '存储读写测试',
    });

    await saveMeeting(meeting);

    const loadedMeeting = await loadMeeting(meeting.id);
    expect(loadedMeeting.id).toBe(meeting.id);
    expect(loadedMeeting.theme).toBe('存储读写测试');
    expect(loadedMeeting.metadata.user_id).toBe('user_fixture_001');
  });

  it('should report meeting existence and delete meeting directory', async () => {
    const meeting = createMeetingFixture({
      id: 'meeting_storage_delete',
    });

    await saveMeeting(meeting);
    await expect(meetingExists(meeting.id)).resolves.toBe(true);

    await deleteMeeting(meeting.id);

    await expect(meetingExists(meeting.id)).resolves.toBe(false);
  });

  it('should throw a readable error when loading a missing meeting', async () => {
    await expect(loadMeeting('meeting_missing')).rejects.toThrow('Meeting not found: meeting_missing');
  });

  it('should update index, keep latest state, and support filter plus pagination', async () => {
    const olderMeeting = createMeetingFixture({
      id: 'meeting_storage_older',
      theme: '较早会议',
      status: 'created',
      timing: {
        created_at: '2026-04-09T08:00:00.000Z',
        expected_duration: 30,
      },
    });
    const newerMeeting = createMeetingFixture({
      id: 'meeting_storage_newer',
      theme: '较新会议',
      status: 'ended',
      timing: {
        created_at: '2026-04-10T08:00:00.000Z',
        started_at: '2026-04-10T08:10:00.000Z',
        ended_at: '2026-04-10T08:40:00.000Z',
        expected_duration: 30,
      },
    });

    await saveMeeting(olderMeeting);
    await saveMeeting(newerMeeting);
    await updateMeetingIndex(olderMeeting.id, olderMeeting);
    await updateMeetingIndex(newerMeeting.id, newerMeeting);

    const updatedOlderMeeting = {
      ...olderMeeting,
      status: 'started' as const,
      timing: {
        ...olderMeeting.timing,
        started_at: '2026-04-09T08:05:00.000Z',
      },
    };
    await updateMeetingIndex(updatedOlderMeeting.id, updatedOlderMeeting);

    const allMeetings = await listMeetings();
    expect(allMeetings.total).toBe(2);
    expect(allMeetings.meetings[0]?.id).toBe('meeting_storage_newer');
    expect(allMeetings.meetings[1]?.id).toBe('meeting_storage_older');
    expect(allMeetings.meetings[1]?.status).toBe('started');

    const endedMeetings = await listMeetings({ status: 'ended' });
    expect(endedMeetings.total).toBe(1);
    expect(endedMeetings.meetings[0]?.id).toBe('meeting_storage_newer');

    const pagedMeetings = await listMeetings({ offset: 1, limit: 1 });
    expect(pagedMeetings.total).toBe(2);
    expect(pagedMeetings.meetings).toHaveLength(1);
    expect(pagedMeetings.meetings[0]?.id).toBe('meeting_storage_older');
  });

  it('should return empty result when no meeting exists in current namespace', async () => {
    const result = await listMeetings();

    expect(result.total).toBe(0);
    expect(result.meetings).toEqual([]);
  });

  it('should keep meeting readable under concurrent writes', async () => {
    const meeting = createMeetingFixture({
      id: 'meeting_storage_concurrent_write',
      theme: '并发写测试',
    });

    await Promise.all(
      Array.from({ length: 30 }, (_, i) => {
        const mutated = {
          ...meeting,
          theme: `并发写测试-${i}`,
          metadata: {
            ...meeting.metadata,
            user_id: `user_${i}`,
          },
        };
        return saveMeeting(mutated);
      })
    );

    const loaded = await loadMeeting(meeting.id);
    expect(loaded.id).toBe(meeting.id);
  });

  it('should keep list result valid under concurrent index updates', async () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      createMeetingFixture({
        id: `meeting_index_concurrent_${i}`,
        theme: `并发索引-${i}`,
      })
    );

    await Promise.all(items.map(item => saveMeeting(item)));
    await Promise.all(items.map(item => updateMeetingIndex(item.id, item)));

    const list = await listMeetings();
    expect(list.total).toBeGreaterThanOrEqual(20);
    expect(list.meetings.some(item => item.id === 'meeting_index_concurrent_0')).toBe(true);
  });
});
