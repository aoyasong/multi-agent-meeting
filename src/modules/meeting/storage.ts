/**
 * 会议存储层
 * 
 * @module modules/meeting/storage
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Meeting } from '../../types/index.js';

/**
 * 默认存储目录
 */
const DEFAULT_STORAGE_DIR = path.join(os.homedir(), '.openclaw', 'meetings');
const fileMutexMap = new Map<string, Promise<void>>();

async function withFileMutex<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const previous = fileMutexMap.get(filePath) ?? Promise.resolve();
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  fileMutexMap.set(filePath, previous.then(() => gate, () => gate));

  await previous;
  try {
    return await task();
  } finally {
    release?.();
  }
}

async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomPart}.tmp`;

  try {
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.rm(tempPath, { force: true });
    } catch {
      // 忽略临时文件清理失败
    }
    throw error;
  }
}

/**
 * 获取存储目录路径
 */
function getStorageDir(): string {
  return process.env.MEETING_STORAGE_DIR || DEFAULT_STORAGE_DIR;
}

/**
 * 确保存储目录存在
 */
async function ensureStorageDir(): Promise<void> {
  const storageDir = getStorageDir();
  await fs.mkdir(storageDir, { recursive: true });
}

/**
 * 获取会议文件路径
 */
function getMeetingFilePath(meetingId: string): string {
  return path.join(getStorageDir(), meetingId, 'metadata.json');
}

/**
 * 获取会议目录路径
 */
export function getMeetingDir(meetingId: string): string {
  return path.join(getStorageDir(), meetingId);
}

/**
 * 保存会议
 */
export async function saveMeeting(meeting: Meeting): Promise<void> {
  await ensureStorageDir();
  
  const meetingDir = getMeetingDir(meeting.id);
  await fs.mkdir(meetingDir, { recursive: true });
  
  const filePath = getMeetingFilePath(meeting.id);
  await withFileMutex(filePath, async () => {
    await atomicWriteFile(filePath, JSON.stringify(meeting, null, 2));
  });
}

/**
 * 加载会议
 */
export async function loadMeeting(meetingId: string): Promise<Meeting> {
  const filePath = getMeetingFilePath(meetingId);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Meeting;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Meeting not found: ${meetingId}`);
    }
    throw error;
  }
}

/**
 * 检查会议是否存在
 */
export async function meetingExists(meetingId: string): Promise<boolean> {
  const filePath = getMeetingFilePath(meetingId);
  
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除会议
 */
export async function deleteMeeting(meetingId: string): Promise<void> {
  const meetingDir = getMeetingDir(meetingId);
  await fs.rm(meetingDir, { recursive: true, force: true });
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
 * 获取索引文件路径
 */
function getIndexPath(): string {
  return path.join(getStorageDir(), 'index.json');
}

/**
 * 更新会议索引
 */
export async function updateMeetingIndex(meetingId: string, meeting: Meeting): Promise<void> {
  await ensureStorageDir();
  
  const indexPath = getIndexPath();
  await withFileMutex(indexPath, async () => {
    let index: MeetingIndexItem[] = [];
    
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(content);
    } catch {
      // 索引文件不存在，使用空数组
    }
    
    // 查找现有条目
    const existingIndex = index.findIndex(item => item.id === meetingId);
    
    const indexItem: MeetingIndexItem = {
      id: meeting.id,
      theme: meeting.theme,
      type: meeting.type,
      status: meeting.status,
      created_at: meeting.timing.created_at,
    };
    
    // 可选字段只在有值时添加
    if (meeting.timing.started_at) {
      indexItem.started_at = meeting.timing.started_at;
    }
    if (meeting.timing.ended_at) {
      indexItem.ended_at = meeting.timing.ended_at;
    }
    
    if (existingIndex >= 0) {
      index[existingIndex] = indexItem;
    } else {
      index.push(indexItem);
    }
    
    // 按创建时间倒序排列
    index.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    await atomicWriteFile(indexPath, JSON.stringify(index, null, 2));
  });
}

/**
 * 列出会议（从索引）
 */
export async function listMeetings(options?: {
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<{ meetings: MeetingIndexItem[]; total: number }> {
  const indexPath = getIndexPath();
  let index: MeetingIndexItem[] = [];
  
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    index = JSON.parse(content);
  } catch {
    // 索引文件不存在，返回空
    return { meetings: [], total: 0 };
  }
  
  // 过滤状态
  let filtered = index;
  if (options?.status) {
    filtered = index.filter(item => item.status === options.status);
  }
  
  const total = filtered.length;
  
  // 分页
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 20;
  const meetings = filtered.slice(offset, offset + limit);
  
  return { meetings, total };
}
