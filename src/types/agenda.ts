/**
 * 议程类型定义
 * 
 * @module types/agenda
 */

/**
 * 议程状态
 */
export type AgendaItemStatus = 
  | 'pending'     // 待讨论
  | 'in_progress' // 讨论中
  | 'voting'      // 投票中
  | 'completed'   // 已完成
  | 'skipped';    // 已跳过

/**
 * 议程时间信息
 */
export interface AgendaItemTiming {
  /** 开始时间 */
  started_at?: string;
  /** 结束时间 */
  ended_at?: string;
  /** 最后提醒时间（还剩5分钟时） */
  last_warning_at?: string;
}

/**
 * 议程项
 */
export interface AgendaItem {
  /** 议程ID */
  id: string;
  /** 议题标题 */
  title: string;
  /** 议题描述 */
  description?: string;
  /** 预计时长（分钟） */
  expected_duration: number;
  /** 实际时长（分钟） */
  actual_duration?: number;
  /** 议程状态 */
  status: AgendaItemStatus;
  /** 时间限制（分钟），超时提醒 */
  time_limit?: number;
  /** 关联材料 */
  materials?: string[];
  /** 时间信息 */
  timing: AgendaItemTiming;
}
