/**
 * 跨Agent消息桥接类型定义
 * 
 * @module types/communication
 */

// 跨Agent中转消息
export interface InterAgentMessage {
  id: string;
  meeting_id: string;
  from_agent_id: string;
  to_agent_id: string;
  content: string;
  reference_agenda_item_id?: string;
  created_at: string;
  is_resolved: boolean;
  reply_content?: string;
  replied_at?: string;
}
