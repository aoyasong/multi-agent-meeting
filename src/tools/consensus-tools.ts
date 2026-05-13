/**
 * 共识流程工具集
 * 
 * @module tools/consensus-tools
 */
import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { jsonResult } from '../utils/json-result.js';
import { loadMeeting, saveMeeting } from '../modules/meeting/storage.js';
import type { ConsensusFeedback } from '../types/index.js';

// ==================== consensus_propose ====================

export const ConsensusProposeToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agenda_item_id: Type.String({ description: '关联的议题ID' }),
  proposal_text: Type.String({ description: '主持人提出的共识提案完整文本' }),
}, { additionalProperties: false });

export function createConsensusProposeTool(_api: OpenClawPluginApi) {
  return {
    name: 'consensus_propose',
    label: 'Consensus Propose',
    description: '主持人基于讨论结果，正式提出一份共识提案，进入共识校验阶段',
    parameters: ConsensusProposeToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agendaItemId = rawParams.agenda_item_id as string;
        const proposalText = rawParams.proposal_text as string;

        const meeting = await loadMeeting(meetingId);
        const agendaItem = meeting.agenda.find(a => a.id === agendaItemId);

        if (!agendaItem) {
          return jsonResult({ error: true, message: `Agenda item not found: ${agendaItemId}` });
        }

        agendaItem.consensus_proposal = proposalText;
        agendaItem.consensus_feedbacks = [];
        agendaItem.status = 'consensus_checking';
        agendaItem.discussion_round += 1;

        await saveMeeting(meeting);

        return jsonResult({
          meeting_id: meetingId,
          agenda_item_id: agendaItemId,
          proposal_text: proposalText,
          status_changed_to: 'consensus_checking',
          proposal_created_at: new Date().toISOString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to propose consensus: ${message}` });
      }
    },
  };
}

// ==================== consensus_collect_feedback ====================

export const ConsensusCollectFeedbackToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agenda_item_id: Type.String({ description: '关联的议题ID' }),
  agent_id: Type.String({ description: '提交反馈的 Agent ID' }),
  agree: Type.Boolean({ description: '是否同意该共识提案' }),
  feedback_text: Type.Optional(Type.String({ description: '补充反馈意见/异议说明' })),
}, { additionalProperties: false });

export function createConsensusCollectFeedbackTool(_api: OpenClawPluginApi) {
  return {
    name: 'consensus_collect_feedback',
    label: 'Consensus Collect Feedback',
    description: '收集单个参会Agent对当前共识提案的同意/反对反馈',
    parameters: ConsensusCollectFeedbackToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agendaItemId = rawParams.agenda_item_id as string;
        const agentId = rawParams.agent_id as string;
        const agree = rawParams.agree as boolean;
        const feedbackText = rawParams.feedback_text as string | undefined;

        const meeting = await loadMeeting(meetingId);
        const agendaItem = meeting.agenda.find(a => a.id === agendaItemId);

        if (!agendaItem) {
          return jsonResult({ error: true, message: `Agenda item not found: ${agendaItemId}` });
        }

        const existingFeedbackIndex = agendaItem.consensus_feedbacks.findIndex(f => f.agent_id === agentId);
        const newFeedback: ConsensusFeedback = {
          agent_id: agentId,
          agree: agree,
          feedback_text: feedbackText,
          responded_at: new Date().toISOString(),
        };

        if (existingFeedbackIndex >= 0) {
          agendaItem.consensus_feedbacks[existingFeedbackIndex] = newFeedback;
        } else {
          agendaItem.consensus_feedbacks.push(newFeedback);
        }

        const allAgents = meeting.participants.filter(p => p.role !== 'observer').map(p => p.agent_id);
        const respondedAgents = agendaItem.consensus_feedbacks.map(f => f.agent_id);
        const allResponded = allAgents.every(agent => respondedAgents.includes(agent));
        const agreeCount = agendaItem.consensus_feedbacks.filter(f => f.agree).length;
        const disagreeCount = agendaItem.consensus_feedbacks.filter(f => !f.agree).length;

        await saveMeeting(meeting);

        return jsonResult({
          meeting_id: meetingId,
          agenda_item_id: agendaItemId,
          feedback_recorded: true,
          agree: agree,
          agree_count: agreeCount,
          disagree_count: disagreeCount,
          total_expected: allAgents.length,
          responded_count: respondedAgents.length,
          all_responded: allResponded,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to collect feedback: ${message}` });
      }
    },
  };
}

// ==================== consensus_finalize ====================

export const ConsensusFinalizeToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agenda_item_id: Type.String({ description: '要标记达成最终共识的议题ID' }),
}, { additionalProperties: false });

export function createConsensusFinalizeTool(_api: OpenClawPluginApi) {
  return {
    name: 'consensus_finalize',
    label: 'Consensus Finalize',
    description: '标记该议题已达成最终全员共识，议题状态转为 resolved',
    parameters: ConsensusFinalizeToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agendaItemId = rawParams.agenda_item_id as string;

        const meeting = await loadMeeting(meetingId);
        const agendaItem = meeting.agenda.find(a => a.id === agendaItemId);

        if (!agendaItem) {
          return jsonResult({ error: true, message: `Agenda item not found: ${agendaItemId}` });
        }

        agendaItem.status = 'resolved';
        agendaItem.consensus_achieved_at = new Date().toISOString();
        agendaItem.timing.ended_at = new Date().toISOString();
        agendaItem.unresolved_questions = [];

        await saveMeeting(meeting);

        return jsonResult({
          meeting_id: meetingId,
          agenda_item_id: agendaItemId,
          consensus_finalized: true,
          finalized_at: agendaItem.consensus_achieved_at,
          status: 'resolved',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to finalize consensus: ${message}` });
      }
    },
  };
}

// ==================== consensus_reopen ====================

export const ConsensusReopenToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agenda_item_id: Type.String({ description: '要重开讨论的议题ID' }),
  reason: Type.String({ description: '重开讨论的原因说明' }),
}, { additionalProperties: false });

export function createConsensusReopenTool(_api: OpenClawPluginApi) {
  return {
    name: 'consensus_reopen',
    label: 'Consensus Reopen',
    description: '发现异议太大时重开该议题讨论，回到 discussing 状态',
    parameters: ConsensusReopenToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agendaItemId = rawParams.agenda_item_id as string;
        const reason = rawParams.reason as string;

        const meeting = await loadMeeting(meetingId);
        const agendaItem = meeting.agenda.find(a => a.id === agendaItemId);

        if (!agendaItem) {
          return jsonResult({ error: true, message: `Agenda item not found: ${agendaItemId}` });
        }

        agendaItem.status = 'discussing';
        agendaItem.consensus_proposal = undefined;
        agendaItem.consensus_feedbacks = [];
        agendaItem.blocked_reason = reason;

        await saveMeeting(meeting);

        return jsonResult({
          meeting_id: meetingId,
          agenda_item_id: agendaItemId,
          reopened: true,
          reason: reason,
          new_status: 'discussing',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to reopen consensus: ${message}` });
      }
    },
  };
}

// ==================== agenda_get_discussion_progress ====================

export const AgendaGetDiscussionProgressToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agenda_item_id: Type.String({ description: '议题ID' }),
}, { additionalProperties: false });

export function createAgendaGetDiscussionProgressTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_get_discussion_progress',
    label: 'Agenda Get Discussion Progress',
    description: '获取指定议题的完整讨论进度详情，包括轮次、发言记录、待处理问题',
    parameters: AgendaGetDiscussionProgressToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agendaItemId = rawParams.agenda_item_id as string;

        const meeting = await loadMeeting(meetingId);
        const agendaItem = meeting.agenda.find(a => a.id === agendaItemId);

        if (!agendaItem) {
          return jsonResult({ error: true, message: `Agenda item not found: ${agendaItemId}` });
        }

        return jsonResult({
          agenda_item_id: agendaItem.id,
          title: agendaItem.title,
          status: agendaItem.status,
          discussion_round: agendaItem.discussion_round,
          max_discussion_rounds: agendaItem.max_discussion_rounds,
          remaining_rounds: agendaItem.max_discussion_rounds - agendaItem.discussion_round,
          total_entries: agendaItem.discussion_entries.length,
          invited_agents: agendaItem.invited_agent_ids,
          unresolved_questions: agendaItem.unresolved_questions,
          escalated_to_user: agendaItem.escalated_to_user,
          has_consensus_proposal: !!agendaItem.consensus_proposal,
          feedbacks_count: agendaItem.consensus_feedbacks.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to get discussion progress: ${message}` });
      }
    },
  };
}

// ==================== agenda_escalate_to_arbitration ====================

export const AgendaEscalateToArbitrationToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  agenda_item_id: Type.String({ description: '需要升级到用户仲裁的议题ID' }),
  summary_of_disagreements: Type.String({ description: '分歧点总结，便于用户快速了解争议' }),
}, { additionalProperties: false });

export function createAgendaEscalateToArbitrationTool(_api: OpenClawPluginApi) {
  return {
    name: 'agenda_escalate_to_arbitration',
    label: 'Agenda Escalate To Arbitration',
    description: '当议题轮次耗尽仍未达成共识时，将分歧整理好升级等待人类用户介入拍板',
    parameters: AgendaEscalateToArbitrationToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const agendaItemId = rawParams.agenda_item_id as string;
        const summaryOfDisagreements = rawParams.summary_of_disagreements as string;

        const meeting = await loadMeeting(meetingId);
        const agendaItem = meeting.agenda.find(a => a.id === agendaItemId);

        if (!agendaItem) {
          return jsonResult({ error: true, message: `Agenda item not found: ${agendaItemId}` });
        }

        agendaItem.status = 'blocked';
        agendaItem.escalated_to_user = true;
        agendaItem.blocked_reason = `已升级等待用户仲裁，分歧点总结: ${summaryOfDisagreements}`;

        await saveMeeting(meeting);

        return jsonResult({
          meeting_id: meetingId,
          agenda_item_id: agendaItemId,
          escalated: true,
          summary_of_disagreements: summaryOfDisagreements,
          status_changed_to: 'blocked',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to escalate to arbitration: ${message}` });
      }
    },
  };
}
