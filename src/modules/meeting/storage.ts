/**
 * 会议存储层
 * 
 * @module modules/meeting/storage
 */
import { Pool } from 'pg';
import type { Meeting } from '../../types/index.js';

let pgPool: Pool | null = null;
let schemaInitPromise: Promise<void> | null = null;
let configuredPgDsn: string | undefined;

export function setDbConfig(config: { pgDsn?: string }): void {
  const normalizedDsn = config.pgDsn?.trim();
  configuredPgDsn = normalizedDsn && normalizedDsn.length > 0 ? normalizedDsn : undefined;
}

export function hasDatabaseConfig(): boolean {
  return Boolean((configuredPgDsn && configuredPgDsn.length > 0) || process.env.PG_DSN?.trim());
}

async function getPool(): Promise<Pool> {
  if (pgPool) {
    return pgPool;
  }

  const dsn = configuredPgDsn || process.env.PG_DSN;
  if (dsn) {
    pgPool = new Pool({ connectionString: dsn });
    return pgPool;
  }

  throw new Error('PG_DSN is required: PostgreSQL storage backend is mandatory');
}

async function ensureSchema(): Promise<void> {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      const pool = await getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS meetings (
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
          CONSTRAINT meetings_id_pkey PRIMARY KEY (id)
        );

        CREATE INDEX IF NOT EXISTS idx_meetings_status_created_at
          ON meetings(status, created_at DESC);
      `);
    })();
  }
  await schemaInitPromise;
}

/**
 * 保存会议
 */
export async function saveMeeting(meeting: Meeting): Promise<void> {
  await ensureSchema();
  const pool = await getPool();
  const values = [
    meeting.id,
    meeting.theme,
    meeting.type,
    meeting.status,
    meeting.timing.created_at,
    meeting.timing.started_at ?? null,
    meeting.timing.ended_at ?? null,
    JSON.stringify(meeting),
  ];

  await pool.query(
    `
      INSERT INTO meetings (id, theme, type, status, created_at, started_at, ended_at, data, version, updated_at)
      VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::timestamptz, $8::jsonb, 1, NOW())
      ON CONFLICT (id) DO UPDATE SET
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
    'SELECT data FROM meetings WHERE id = $1',
    [meetingId]
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
  const result = await pool.query('SELECT 1 FROM meetings WHERE id = $1 LIMIT 1', [meetingId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 删除会议
 */
export async function deleteMeeting(meetingId: string): Promise<void> {
  await ensureSchema();
  const pool = await getPool();
  await pool.query('DELETE FROM meetings WHERE id = $1', [meetingId]);
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

  let whereClause = `WHERE 1 = 1`;
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
