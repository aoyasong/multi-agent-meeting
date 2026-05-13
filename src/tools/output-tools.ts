/**
 * 会议产出工具
 * 
 * @module tools/output-tools
 */

import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { jsonResult } from '../utils/json-result.js';
import { generateId } from '../utils/id-generator.js';
import { loadMeeting } from '../modules/meeting/storage.js';
import type { MeetingSummary, AgendaSummary, Perspective, Decision, ActionItem } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

let outputBaseDir: string | null = null;
export const DEFAULT_EXPORT_DIR = path.join(os.homedir(), '.openclaw', 'meetings');

export function setOutputBaseDir(dir: string): void {
  outputBaseDir = dir;
}

export function hasOutputBaseDir(): boolean {
  return Boolean((outputBaseDir && outputBaseDir.length > 0) || process.env.OUTPUT_DIR?.trim());
}

export function getOutputDir(meetingId: string): string {
  return path.join(outputBaseDir || DEFAULT_EXPORT_DIR, meetingId);
}

export async function createOutputDir(meetingId: string): Promise<void> {
  const outputDir = getOutputDir(meetingId);
  await fs.mkdir(outputDir, { recursive: true });
}

// ==================== output_generate_summary ====================
export const OutputGenerateSummaryToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
}, { additionalProperties: false });

export function createOutputGenerateSummaryTool(_api: OpenClawPluginApi) {
  return {
    name: 'output_generate_summary',
    label: 'Output Generate Summary',
    description: '生成会议纪要，包含议程摘要、决策和待办',
    parameters: OutputGenerateSummaryToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const meeting = await loadMeeting(meetingId);

        // 生成议程摘要
        const agendaSummaries: AgendaSummary[] = meeting.agenda.map(agenda => {
          // 获取该议程的笔记
          const agendaNotes = meeting.notes.filter(n => n.agenda_item_id === agenda.id);
          
          // 提取观点
          const perspectives: Perspective[] = [];
          const agentNotes = new Map<string, typeof agendaNotes>();
          
          for (const note of agendaNotes) {
            if (!agentNotes.has(note.agent_id)) {
              agentNotes.set(note.agent_id, []);
            }
            agentNotes.get(note.agent_id)!.push(note);
          }

          for (const [agentId, notes] of agentNotes) {
            perspectives.push({
              agent_id: agentId,
              summary: notes.map(n => n.raw_content).join('; ').substring(0, 200),
            });
          }

          // 查找该议程的投票结果
          const votingResult = meeting.voting_history.find(
            v => v.agenda_item_id === agenda.id && v.result
          )?.result;

          return {
            agenda_id: agenda.id,
            title: agenda.title,
            key_points: agendaNotes
              .filter(n => n.message_type === 'statement' || n.message_type === 'insight')
              .slice(0, 5)
              .map(n => n.raw_content.substring(0, 100)),
            perspectives,
            voting_result: votingResult,
          };
        });

        // 提取决策
        const decisions: Decision[] = [];
        for (const voting of meeting.voting_history) {
          if (voting.result && voting.result.winner_id) {
            const winnerText = voting.options.find(o => o.id === voting.result?.winner_id)?.text;
            decisions.push({
              id: generateId('decision'),
              content: `${voting.topic}: ${winnerText}`,
              rationale: `通过投票决定 (${voting.result.tallies[0]?.count ?? 0}票)`,
              voting_result: voting.result,
            });
          }
        }

        // 提取待办
        const actionItems: ActionItem[] = meeting.notes
          .filter(n => n.message_type === 'action' || n.insight_tags?.includes('action'))
          .map(n => ({
            id: generateId('action'),
            content: n.raw_content.substring(0, 200),
            source_agent: n.agent_id,
            source_speaking_id: n.id,
          }));

        const summary: MeetingSummary = {
          meeting_id: meetingId,
          participants: meeting.participants.map(p => p.agent_id),
          agenda_summaries: agendaSummaries,
          key_decisions: decisions,
          action_items: actionItems,
          generated_at: new Date().toISOString(),
        };

        // 保存摘要
        await createOutputDir(meetingId);
        const summaryPath = path.join(getOutputDir(meetingId), 'summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

        return jsonResult({
          success: true,
          summary: {
            meeting_id: summary.meeting_id,
            participants_count: summary.participants.length,
            agenda_count: agendaSummaries.length,
            decisions_count: decisions.length,
            action_items_count: actionItems.length,
            generated_at: summary.generated_at,
          },
          saved_to: summaryPath,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to generate summary: ${message}` });
      }
    },
  };
}

// ==================== output_generate_action_items ====================

export const OutputGenerateActionItemsToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
}, { additionalProperties: false });

export function createOutputGenerateActionItemsTool(_api: OpenClawPluginApi) {
  return {
    name: 'output_generate_action_items',
    label: 'Output Generate Action Items',
    description: '提取会议待办事项',
    parameters: OutputGenerateActionItemsToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const meeting = await loadMeeting(meetingId);

        // 从笔记中提取待办
        const actionItems: ActionItem[] = meeting.notes
          .filter(n => n.message_type === 'action' || n.insight_tags?.includes('action'))
          .map(n => ({
            id: generateId('action'),
            content: n.raw_content,
            source_agent: n.agent_id,
            source_speaking_id: n.id,
          }));

        return jsonResult({
          meeting_id: meetingId,
          action_items: actionItems,
          total: actionItems.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to generate action items: ${message}` });
      }
    },
  };
}

// ==================== output_export ====================

export const OutputExportToolSchema = Type.Object({
  meeting_id: Type.String({ description: '会议ID' }),
  format: Type.Union([
    Type.Literal('markdown'),
    Type.Literal('json'),
  ], { description: '导出格式' }),
  content: Type.Array(Type.Union([
    Type.Literal('summary'),
    Type.Literal('transcript'),
    Type.Literal('actions'),
  ]), { description: '导出内容类型' }),
  target_path: Type.Optional(Type.String({ description: '目标路径' })),
}, { additionalProperties: false });

export function createOutputExportTool(_api: OpenClawPluginApi) {
  return {
    name: 'output_export',
    label: 'Output Export',
    description: '导出会议产出为指定格式',
    parameters: OutputExportToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      try {
        const meetingId = rawParams.meeting_id as string;
        const format = rawParams.format as 'markdown' | 'json';
        const contentTypes = rawParams.content as string[];
        const targetPath = rawParams.target_path as string | undefined;

        const meeting = await loadMeeting(meetingId);
        const meetingDir = targetPath || getOutputDir(meetingId);
        const files: Array<{ type: string; path: string }> = [];

        // 导出各类内容
        for (const contentType of contentTypes) {
          const fileName = `${contentType}.${format}`;
          const filePath = path.join(meetingDir, fileName);

          let content: string;

          if (format === 'json') {
            content = JSON.stringify(getContentData(contentType, meeting), null, 2);
          } else {
            content = formatAsMarkdown(contentType, meeting);
          }

          await fs.mkdir(meetingDir, { recursive: true });
          await fs.writeFile(filePath, content, 'utf-8');
          files.push({ type: contentType, path: filePath });
        }

        return jsonResult({
          success: true,
          meeting_id: meetingId,
          format,
          files,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return jsonResult({ error: true, message: `Failed to export: ${message}` });
      }
    },
  };
}

// 辅助函数：获取内容数据
function getContentData(type: string, meeting: any): unknown {
  switch (type) {
    case 'summary':
      return {
        theme: meeting.theme,
        purpose: meeting.purpose,
        status: meeting.status,
        timing: meeting.timing,
        participants: meeting.participants,
        agenda: meeting.agenda,
        voting_history: meeting.voting_history,
      };
    case 'transcript':
      return meeting.notes;
    case 'actions':
      return meeting.notes.filter((n: any) => 
        n.message_type === 'action' || n.insight_tags?.includes('action')
      );
    default:
      return null;
  }
}

// 辅助函数：格式化为Markdown
function formatAsMarkdown(type: string, meeting: any): string {
  const lines: string[] = [];

  switch (type) {
    case 'summary':
      lines.push(`# ${meeting.theme}`, '');
      lines.push(`**目的**: ${meeting.purpose}`, '');
      lines.push(`**状态**: ${meeting.status}`, '');
      lines.push(`**时间**: ${meeting.timing.started_at} - ${meeting.timing.ended_at}`, '');
      lines.push('', '## 参会人', '');
      for (const p of meeting.participants) {
        lines.push(`- ${p.agent_id} (${p.role})`);
      }
      lines.push('', '## 议程', '');
      for (const a of meeting.agenda) {
        lines.push(`### ${a.title}`, '');
        lines.push(`状�? ${a.status}`, '');
      }
      if (meeting.voting_history.length > 0) {
        lines.push('', '## 投票决策', '');
        for (const v of meeting.voting_history) {
          const winner = v.result?.winner_id
            ? v.options.find((o: any) => o.id === v.result?.winner_id)?.text
            : '无共识';
          lines.push(`- ${v.topic}: ${winner}`);
        }
      }
      break;

    case 'transcript':
      lines.push(`# 会议记录 - ${meeting.theme}`, '');
      for (const note of meeting.notes) {
        lines.push(`### [${note.timestamp}] ${note.agent_id}`, '');
        lines.push(note.raw_content, '');
      }
      break;

    case 'actions':
      lines.push(`# 待办事项 - ${meeting.theme}`, '');
      const actions = meeting.notes.filter((n: any) => 
        n.message_type === 'action' || n.insight_tags?.includes('action')
      );
      for (const a of actions) {
        lines.push(`- [ ] ${a.raw_content} (来源: ${a.agent_id})`);
      }
      break;
  }

  return lines.join('\n');
}
