/**
 * 会议存储层
 * 
 * @module modules/meeting/storage
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { Pool } from 'pg';
import type { Meeting } from '../../types/index.js';

/**
 * 默认存储目录
 */
const DEFAULT_EXPORT_DIR = path.join(os.homedir(), '.openclaw', 'meetings');
let pgPool: Pool | null = null;
let schemaInitPromise: Promise<void> | null = null;
let isPgMemBackend = false;
let configuredPgDsn: string | undefined;
let configuredExportDir: string | undefined;

export function setStorageConfig(config: { pgDsn?: string; storageDir?: string }): void {
  const normalizedDsn = config.pgDsn?.trim();
  const normalizedStorageDir = config.storageDir?.trim();

  configuredPgDsn = normalizedDsn && normalizedDsn.length > 0 ? normalizedDsn : undefined;
  configuredExportDir =
    normalizedStorageDir && normalizedStorageDir.length > 0 ? normalizedStorageDir : undefined;
}

export function hasDatabaseConfig(): boolean {
  return Boolean((configuredPgDsn && configuredPgDsn.length > 0) || process.env.PG_DSN?.trim());
}

function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
}

async function getPool(): Promise<Pool> {
  if (pgPool) {
    return pgPool;
  }

  const dsn = configuredPgDsn || process.env.PG_DSN;
  if (dsn) {
    isPgMemBackend = false;
    pgPool = new Pool({ connectionString: dsn });
    return pgPool;
  }

  if (isTestEnv()) {
    const testGlobal = globalThis as Record<string, unknown>;
    const existing = testGlobal.__MEETING_PLUGIN_PG_POOL as Pool | undefined;
    if (existing) {
      pgPool = existing;
      isPgMemBackend = true;
      return pgPool;
    }

    const { newDb } = await import('pg-mem');
    const db = newDb();
    const adapter = db.adapters.createPg();
    pgPool = new adapter.Pool() as unknown as Pool;
    isPgMemBackend = true;
    testGlobal.__MEETING_PLUGIN_PG_POOL = pgPool;
    return pgPool;
  }

  throw new Error('PG_DSN is required: PostgreSQL storage backend is mandatory');
}

async function ensureSchema(): Promise<void> {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      const pool = await getPool();
      if (isPgMemBackend) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS meetings (
            storage_ns TEXT,
            id TEXT,
            theme TEXT,
            type TEXT,
            status TEXT,
            created_at TEXT,
            started_at TEXT,
            ended_at TEXT,
            data JSON,
            version INTEGER,
            updated_at TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_meetings_status_created_at
            ON meetings(storage_ns, status, created_at DESC);
        `);
      } else {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS meetings (
            storage_ns TEXT NOT NULL,
            id TEXT NOT NULL,
            theme TEXT NOT NULL,
            type TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            started_at TIMESTAMPTZ NULL,
            ended_at TIMESTAMPTZ NULL,
            data JSONB NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT meetings_storage_ns_id_pkey PRIMARY KEY (storage_ns, id)
          );

          CREATE INDEX IF NOT EXISTS idx_meetings_status_created_at
            ON meetings(storage_ns, status, created_at DESC);
        `);
      }
    })();
  }
  await schemaInitPromise;
}

/**
 * 获取存储目录路径
 */
function getExportDir(): string {
  return configuredExportDir || process.env.MEETING_STORAGE_DIR || DEFAULT_EXPORT_DIR;
}

function getStorageNamespace(): string {
  return configuredExportDir || process.env.MEETING_STORAGE_DIR || '__default__';
}

/**
 * 获取会议文件路径
 */
export function getMeetingDir(meetingId: string): string {
  return path.join(getExportDir(), meetingId);
}

/**
 * 保存会议
 */
export async function saveMeeting(meeting: Meeting): Promise<void> {
  await ensureSchema();
  await fs.mkdir(getMeetingDir(meeting.id), { recursive: true });
  const pool = await getPool();
  const values = [
    getStorageNamespace(),
    meeting.id,
    meeting.theme,
    meeting.type,
    meeting.status,
    meeting.timing.created_at,
    meeting.timing.started_at ?? null,
    meeting.timing.ended_at ?? null,
    JSON.stringify(meeting),
  ];

  if (isPgMemBackend) {
    await pool.query('DELETE FROM meetings WHERE storage_ns = $1 AND id = $2', values.slice(0, 2));
    await pool.query(
      `
        INSERT INTO meetings (storage_ns, id, theme, type, status, created_at, started_at, ended_at, data, version, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $6)
      `,
      values
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO meetings (storage_ns, id, theme, type, status, created_at, started_at, ended_at, data, version, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz, $9::jsonb, 1, NOW())
      ON CONFLICT (storage_ns, id) DO UPDATE SET
        theme = EXCLUDED.theme,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at,
        started_at = EXCLUDED.started_at,
        ended_at = EXCLUDED.ended_at,
        data = EXCLUDED.data,
        version = meetings.version + 1,
        updated_at = NOW()
    `,
    values
  );
}

/**
 * 加载会议
 */
export async function loadMeeting(meetingId: string): Promise<Meeting> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query<{ data: Meeting }>(
    'SELECT data FROM meetings WHERE storage_ns = $1 AND id = $2',
    [getStorageNamespace(), meetingId]
  );
  if (result.rowCount === 0) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }
  return result.rows[0]!.data;
}

/**
 * 检查会议是否存在
 */
export async function meetingExists(meetingId: string): Promise<boolean> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query('SELECT 1 FROM meetings WHERE storage_ns = $1 AND id = $2 LIMIT 1', [getStorageNamespace(), meetingId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 删除会议
 */
export async function deleteMeeting(meetingId: string): Promise<void> {
  await ensureSchema();
  const pool = await getPool();
  await pool.query('DELETE FROM meetings WHERE storage_ns = $1 AND id = $2', [getStorageNamespace(), meetingId]);
}

/**
 * 会议索引项
 */
interface MeetingIndexItem {
  id: string;
  theme: string;
  type: string;
  status: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
}

/**
 * 更新会议索引
 */
export async function updateMeetingIndex(meetingId: string, meeting: Meeting): Promise<void> {
  // PostgreSQL 后端下索引由 SQL 查询替代。这里保留兼容语义：调用时同步会议最新状态到数据库。
  if (meetingId !== meeting.id) {
    throw new Error(`Meeting id mismatch: ${meetingId} !== ${meeting.id}`);
  }
  await saveMeeting(meeting);
}

/**
 * 列出会议（从索引）
 */
export async function listMeetings(options?: {
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<{ meetings: MeetingIndexItem[]; total: number }> {
  await ensureSchema();
  const pool = await getPool();

  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 20;
  const params: unknown[] = [];

  let whereClause = `WHERE storage_ns = $${params.push(getStorageNamespace())}`;
  if (options?.status) {
    params.push(options.status);
    whereClause += ` AND status = $${params.length}`;
  }

  const totalSql = `SELECT COUNT(*)::int AS total FROM meetings ${whereClause}`;
  const totalResult = await pool.query<{ total: number }>(totalSql, params);
  const total = totalResult.rows[0]?.total ?? 0;

  params.push(limit, offset);
  const meetingsSql = `
    SELECT id, theme, type, status, created_at, started_at, ended_at
    FROM meetings
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;
  const rows = await pool.query<MeetingIndexItem>(meetingsSql, params);
  return { meetings: rows.rows, total };
}
