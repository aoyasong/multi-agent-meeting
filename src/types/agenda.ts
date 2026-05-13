/**
 * 议程类型定义
 * 
 * @module types/agenda
 */

/**
 * 议程状态
 */
export type AgendaItemStatus = 
  | 'pending'           // 待讨论
  | 'discussing'        // 正在讨论
  | 'consensus_checking' // 共识校验中
  | 'resolved'          // 议题已最终解决
  | 'blocked'           // 议题被阻塞
  | 'in_progress'       // 兼容旧版：讨论中
  | 'voting'            // 投票中
  | 'completed'         // 所有关联任务已完成
  | 'agreed'            // 已达成全员共识
  | 'skipped';          // 已跳过

/**
 * 议题讨论记录项
 */
export interface DiscussionEntry {
  id: string;
  agent_id: string;
  content: string;
  timestamp: string;
  type: 'speech' | 'question' | 'answer' | 'comment';
  reference_to?: string;
}

/**
 * 共识提案反馈项
 */
export interface ConsensusFeedback {
  agent_id: string;
  agree: boolean;
  feedback_text?: string;
  responded_at: string;
}

/**
 * 议程时间信息
 */
export interface AgendaItemTiming {
  /** 开始时间 */
  started_at?: string;
  /** 结束时间 */
  ended_at?: string;
  /** 达成共识时间 */
  agreed_at?: string;
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
  /** 关联的任务ID列表（该议程下所有要完成的任务） */
  task_ids: string[];
  /** 时间限制（分钟），超时提醒 */
  time_limit?: number;
  /** 关联材料 */
  materials?: string[];
  /** 时间信息 */
  timing: AgendaItemTiming;
  
  // --- 新增：议题讨论状态追踪 ---
  discussion_round: number;
  max_discussion_rounds: number;
  discussion_entries: DiscussionEntry[];
  invited_agent_ids: string[];
  pending_agent_ids: string[];
  
  // --- 新增：共识流程 ---
  consensus_proposal?: string;
  consensus_feedbacks: ConsensusFeedback[];
  consensus_achieved_at?: string;
  
  // --- 新增：异议与阻塞 ---
  unresolved_questions: string[];
  blocked_reason?: string;
  escalated_to_user: boolean;
}
