import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';

import { createMeetingFixture, createTestStorageDir } from '../helpers/test-helpers.js';

describe('Restart reliability', () => {
  let storageDir: string;

  beforeEach(() => {
    storageDir = createTestStorageDir('meeting-restart-test');
    process.env.MEETING_STORAGE_DIR = storageDir;
  });

  afterEach(async () => {
    delete process.env.MEETING_STORAGE_DIR;
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('should keep meeting and index readable after module reset (simulated restart)', async () => {
    const initialStorage = await import('../../src/modules/meeting/storage.js');
    const meeting = createMeetingFixture({
      id: 'meeting_restart_001',
      theme: '重启恢复测试',
      status: 'in_progress',
      timing: {
        created_at: '2026-04-10T09:00:00.000Z',
        started_at: '2026-04-10T09:05:00.000Z',
        expected_duration: 60,
      },
    });

    await initialStorage.saveMeeting(meeting);
    await initialStorage.updateMeetingIndex(meeting.id, meeting);

    vi.resetModules();
    const reloadedStorage = await import('../../src/modules/meeting/storage.js');

    const loadedMeeting = await reloadedStorage.loadMeeting('meeting_restart_001');
    const list = await reloadedStorage.listMeetings({ status: 'in_progress' });

    expect(loadedMeeting.id).toBe('meeting_restart_001');
    expect(loadedMeeting.theme).toBe('重启恢复测试');
    expect(list.total).toBe(1);
    expect(list.meetings[0]?.id).toBe('meeting_restart_001');
    expect(list.meetings[0]?.status).toBe('in_progress');
  });

  it('should keep list available after module reset without index file dependency', async () => {
    const storage = await import('../../src/modules/meeting/storage.js');
    const meeting = createMeetingFixture({
      id: 'meeting_restart_002',
    });
    await storage.saveMeeting(meeting);
    await storage.updateMeetingIndex(meeting.id, meeting);

    vi.resetModules();
    const reloadedStorage = await import('../../src/modules/meeting/storage.js');
    const list = await reloadedStorage.listMeetings();
    const loadedMeeting = await reloadedStorage.loadMeeting('meeting_restart_002');

    expect(list.total).toBe(1);
    expect(list.meetings[0]?.id).toBe('meeting_restart_002');
    expect(loadedMeeting.id).toBe('meeting_restart_002');
  });
});
