/**
 * 会议实体类型定义
 * 
 * @module types/meeting
 */

import type { MeetingConfig } from './common.js';
import type { AgendaItem } from './agenda.js';
import type { MeetingNote } from './recording.js';
import type { Voting } from './voting.js';
import type { MeetingTask } from './task.js';
import type { SpeakingQueueItem } from './speaking.js';

/**
 * 会议类型
 */
export type MeetingType = 
  | 'brainstorm'         // 头脑风暴
  | 'requirement_review' // 需求评审
  | 'tech_review'        // 技术评审
  | 'project_kickoff';   // 项目启动

/**
 * 会议状态
 */
export type MeetingStatus = 
  | 'created'      // 已创建
  | 'started'      // 已开始
  | 'in_progress'  // 进行中
  | 'paused'       // 已暂停
  | 'takeover'     // 用户接管
  | 'ended';       // 已结束

/**
 * 参与者角色
 */
export type ParticipantRole = 
  | 'host'        // 主Agent（会议主持人）
  | 'participant' // 参会者
  | 'observer';   // 观察员

/**
 * 参与者状态
 */
export type ParticipantStatus = 
  | 'invited'   // 已邀请
  | 'joined'    // 已加入
  | 'left';     // 已离开

/**
 * 参与者
 */
export interface Participant {
  /** Agent标识 */
  agent_id: string;
  /** 角色 */
  role: ParticipantRole;
  /** 状态 */
  status: ParticipantStatus;
  /** 加入时间 */
  joined_at?: string;
  /** 离开时间 */
  left_at?: string;
  /** 发言次数 */
  speaking_count: number;
  /** 最后活跃时间 */
  last_active_at?: string;
}

/**
 * 会议时间信息
 */
export interface MeetingTiming {
  /** 创建时间 */
  created_at: string;
  /** 开始时间 */
  started_at?: string;
  /** 结束时间 */
  ended_at?: string;
  /** 预计时长（分钟） */
  expected_duration: number;
  /** 实际时长（分钟） */
  actual_duration?: number;
  /** 暂停时间点 */
  paused_at?: string;
}

/**
 * 会议元数据
 */
export interface MeetingMetadata {
  /** 会议会话ID */
  session_id: string;
  /** 用户ID */
  user_id: string;
  /** 议程是否已确认（确认后才允许开始会议） */
  agenda_confirmed: boolean;
  /** 议程确认时间 */
  agenda_confirmed_at?: string;
  /** 关联材料 */
  materials?: string[];
  /** 标签 */
  tags?: string[];
  /** 备注 */
  remarks?: string;
}

/**
 * 会议实体 - 核心数据结构
 */
export interface Meeting {
  /** 会议唯一标识 */
  id: string;
  /** 会议主题 */
  theme: string;
  /** 会议目的 */
  purpose: string;
  /** 会议类型 */
  type: MeetingType;
  /** 主Agent标识 */
  host_agent: string;
  /** 参与者列表 */
  participants: Participant[];
  /** 议程列表 */
  agenda: AgendaItem[];
  /** 会议状态 */
  status: MeetingStatus;
  /** 当前议程索引 */
  current_agenda_index: number;
  /** 时间信息 */
  timing: MeetingTiming;
  /** 会议配置 */
  config: MeetingConfig;
  /** 会议记录 */
  notes: MeetingNote[];
  /** 投票历史 */
  voting_history: Voting[];
  /** 任务列表 */
  tasks: MeetingTask[];
  /** 发言状态（运行时持久化） */
  speaking_state?: {
    current_speaker?: string;
    queue: SpeakingQueueItem[];
    granted_at?: string;
  };
  /** 元数据 */
  metadata: MeetingMetadata;
}

// 从common.js重新导出MeetingConfig供使用
export type { MeetingConfig } from './common.js';
