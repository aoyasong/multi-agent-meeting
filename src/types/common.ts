/**
 * 通用类型定义与常量
 * 
 * @module types/common
 */

/**
 * 投票窗口配置
 */
export interface VotingWindowConfig {
  /** 简单决策窗口（秒） */
  simple: number;
  /** 中等复杂度窗口（秒） */
  moderate: number;
  /** 复杂决策窗口（秒） */
  complex: number;
}

/**
 * 默认投票窗口配置（秒）
 */
export const DEFAULT_VOTING_WINDOWS: VotingWindowConfig = {
  simple: 180,    // 3分钟
  moderate: 300,  // 5分钟
  complex: 600,   // 10分钟
};

/**
 * 会议配置
 */
export interface MeetingConfig {
  /** PostgreSQL 连接串 */
  pgDsn: string;
  /** 导出文件目录 */
  outputBaseDir: string;
  /** 轮询间隔（毫秒） */
  poll_interval_ms: number;
  /** Agent响应超时（毫秒） */
  agent_timeout_ms: number;
  /** 投票窗口配置 */
  voting_windows: VotingWindowConfig;
  /** 是否允许用户中断 */
  allow_interrupt: boolean;
  /** 自动保存间隔（毫秒） */
  auto_save_interval_ms: number;
  /** Agent响应超时（毫秒） */
  agentResponseTimeoutMs: number;
  /** 默认议题最大讨论轮次 */
  defaultMaxDiscussionRounds: number;
}

/**
 * 默认会议配置
 */
export const DEFAULT_MEETING_CONFIG: MeetingConfig = {
  pgDsn: '',
  outputBaseDir: '',
  poll_interval_ms: 5000,        // 5秒轮询
  agent_timeout_ms: 30000,       // 30秒超时
  voting_windows: DEFAULT_VOTING_WINDOWS,
  allow_interrupt: true,
  auto_save_interval_ms: 60000,  // 1分钟自动保存
  agentResponseTimeoutMs: 60000, // 60秒Agent响应超时
  defaultMaxDiscussionRounds: 3,  // 默认议题最大3轮讨论
};

/**
 * 会议元数据
 */
export interface MeetingMetadata {
  /** 会议会话ID */
  session_id: string;
  /** 用户ID */
  user_id: string;
  /** 关联材料 */
  materials?: string[];
  /** 标签 */
  tags?: string[];
  /** 备注 */
  remarks?: string;
}

/**
 * 暂停状态（用于恢复）
 */
export interface PausedMeetingState {
  /** 会议ID */
  meeting_id: string;
  /** 当前议程索引 */
  current_agenda_index: number;
  /** 已完成议程 */
  completed_agenda_items: unknown[];
  /** 当前议程的讨论记录 */
  current_transcript: unknown[];
  /** 投票结果历史 */
  voting_results: unknown[];
  /** 暂停时间 */
  paused_at: string;
  /** 暂停时的发言队列 */
  speaking_queue: unknown[];
}