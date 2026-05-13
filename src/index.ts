/**
 * 多Agent协同会议系统 - Plugin入口
 *
 * @packageDocumentation
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { hasDatabaseConfig, setDbConfig } from "./modules/meeting/storage.js";
import { hasOutputBaseDir, setOutputBaseDir, DEFAULT_EXPORT_DIR} from "./tools/output-tools.js";

// 会议生命周期工具
import { createMeetingCreateTool } from "./tools/meeting-create.js";
import { createMeetingStartReadinessTool } from "./tools/meeting-start-readiness.js";
import { createMeetingStartTool } from "./tools/meeting-start.js";
import { createMeetingEndTool } from "./tools/meeting-end.js";
import { createMeetingGetTool } from "./tools/meeting-get.js";
import { createMeetingListTool } from "./tools/meeting-list.js";
import { DEFAULT_MEETING_CONFIG, type MeetingConfig } from "./types/common.js";

// 议程管理工具
import {
  createAgendaAddItemTool,
  createAgendaConfirmTool,
  createAgendaListItemsTool,
  createAgendaNextItemTool,
  createAgendaRemoveItemTool,
  createAgendaReorderItemsTool,
  createAgendaUpdateItemTool,
  createAgendaAttachTaskTool,
  createParticipantConfirmReceivedTool,
  createAgendaDashboardTool,
} from "./tools/agenda-tools.js";

// 发言协调工具
import {
  createSpeakingRequestTool,
  createSpeakingGrantTool,
  createSpeakingReleaseTool,
  createSpeakingStatusTool,
} from './tools/speaking-tools.js';

// 主持人主动调度工具
import {
  createSpeakingInviteTool,
  createSpeakingRaiseQuestionTool,
  createSpeakingPauseTopicTool,
} from './tools/direct-speaking-tools.js';

// 共识流程工具集
import {
  createConsensusProposeTool,
  createConsensusCollectFeedbackTool,
  createConsensusFinalizeTool,
  createConsensusReopenTool,
  createAgendaGetDiscussionProgressTool,
  createAgendaEscalateToArbitrationTool,
} from './tools/consensus-tools.js';

// 跨Agent消息桥接工具
import {
  createCommunicationRelayMessageTool,
  createCommunicationListUnresolvedQuestionsTool,
  createAgendaGenerateContextSnapshotTool,
} from './tools/communication-tools.js';

// 投票决策工具
import {
  createVotingCreateTool,
  createVotingCastTool,
  createVotingGetResultTool,
  createVotingEndTool,
  createVotingOverrideTool,
} from "./tools/voting-tools.js";

// 会议记录工具
import {
  createRecordingTakeNoteTool,
  createRecordingTagInsightTool,
  createRecordingGetTranscriptTool,
} from "./tools/recording-tools.js";

// 会议产出工具
import {
  createOutputGenerateSummaryTool,
  createOutputGenerateActionItemsTool,
  createOutputExportTool,
} from "./tools/output-tools.js";

// 任务管理工具
import {
  createMeetingAssignTaskTool,
  createMeetingRecordTaskResultTool,
  createMeetingGetTaskTool,
  createMeetingListTasksTool,
  createMeetingUpdateTaskStatusTool,
} from "./tools/task-tools.js";

// 自定义命令
import { createMeetingCommands } from "./commands/meeting-commands.js";

/**
 * Plugin入口定义
 */
export default definePluginEntry({
  id: "multi-agent-meeting",
  name: "Multi Agent Meeting",
  description:
    "多Agent协同会议系统，支持头脑风暴、需求评审、技术评审、项目启动等场景",

  register(api: OpenClawPluginApi) {
    const raw = api.pluginConfig && typeof api.pluginConfig === "object" ? (api.pluginConfig as any) : {};
    const cfg: MeetingConfig = {...DEFAULT_MEETING_CONFIG, ...raw};
    if (!raw) {
      throw new Error("Meeting plugin config is not an object.");
    }
    const pgDsn = typeof cfg.pgDsn === "string" ? cfg.pgDsn : undefined;
    setDbConfig({ pgDsn });

    if (!hasDatabaseConfig()) {
      throw new Error(
       "PostgreSQL configuration missing in plugin runtime: PG_DSN exists but plugin cannot read effective pgDsn. Check plugin loading source and runtime config injection."   
      );
    }

    const outputBaseDir = typeof cfg.outputBaseDir === "string" ? cfg.outputBaseDir : DEFAULT_EXPORT_DIR;
    setOutputBaseDir(outputBaseDir);
    if (!hasOutputBaseDir()) {
      throw new Error(
        "Output base directory missing in plugin runtime: OUTPUT_BASE_DIR exists but plugin cannot read effective outputBaseDir. Check plugin loading source and runtime config injection."
      );
    }

    // 当前插件工具返回结构沿用既有实现；通过窄封装兼容 SDK 注册签名。
    const registerTool = (tool: unknown) => api.registerTool(tool as never);

    // 会议生命周期工具 (6)
    registerTool(createMeetingCreateTool(api));
    registerTool(createMeetingStartReadinessTool(api));
    registerTool(createMeetingStartTool(api));
    registerTool(createMeetingEndTool(api));
    registerTool(createMeetingGetTool(api));
    registerTool(createMeetingListTool(api));

    // 议程管理工具 (10)
    registerTool(createAgendaAddItemTool(api));
    registerTool(createAgendaUpdateItemTool(api));
    registerTool(createAgendaRemoveItemTool(api));
    registerTool(createAgendaReorderItemsTool(api));
    registerTool(createAgendaConfirmTool(api));
    registerTool(createAgendaListItemsTool(api));
    registerTool(createAgendaNextItemTool(api));
    registerTool(createAgendaAttachTaskTool(api));
    registerTool(createParticipantConfirmReceivedTool(api));
    registerTool(createAgendaDashboardTool(api));

    // 发言协调工具 (4)
    registerTool(createSpeakingRequestTool(api));
    registerTool(createSpeakingGrantTool(api));
    registerTool(createSpeakingReleaseTool(api));
    registerTool(createSpeakingStatusTool(api));
    
    // 主持人主动调度工具 (3)
    registerTool(createSpeakingInviteTool(api));
    registerTool(createSpeakingRaiseQuestionTool(api));
    registerTool(createSpeakingPauseTopicTool(api));

    // 共识流程工具集 (6)
    registerTool(createConsensusProposeTool(api));
    registerTool(createConsensusCollectFeedbackTool(api));
    registerTool(createConsensusFinalizeTool(api));
    registerTool(createConsensusReopenTool(api));
    registerTool(createAgendaGetDiscussionProgressTool(api));
    registerTool(createAgendaEscalateToArbitrationTool(api));

    // 跨Agent消息桥接工具 (3)
    registerTool(createCommunicationRelayMessageTool(api));
    registerTool(createCommunicationListUnresolvedQuestionsTool(api));
    registerTool(createAgendaGenerateContextSnapshotTool(api));

    // 投票决策工具 (5)
    registerTool(createVotingCreateTool(api));
    registerTool(createVotingCastTool(api));
    registerTool(createVotingGetResultTool(api));
    registerTool(createVotingEndTool(api));
    registerTool(createVotingOverrideTool(api));

    // 会议记录工具 (3)
    registerTool(createRecordingTakeNoteTool(api));
    registerTool(createRecordingTagInsightTool(api));
    registerTool(createRecordingGetTranscriptTool(api));

    // 会议产出工具 (3)
    registerTool(createOutputGenerateSummaryTool(api));
    registerTool(createOutputGenerateActionItemsTool(api));
    registerTool(createOutputExportTool(api));

    // 任务管理工具 (5)
    registerTool(createMeetingAssignTaskTool(api));
    registerTool(createMeetingRecordTaskResultTool(api));
    registerTool(createMeetingGetTaskTool(api));
    registerTool(createMeetingListTasksTool(api));
    registerTool(createMeetingUpdateTaskStatusTool(api));

    // 注册自定义命令
    const commands = createMeetingCommands(api);
    for (const command of commands) {
      api.registerCommand(command);
    }

    api.logger.info("Meeting plugin registered with 33 tools and 5 commands");
  },
});

// 导出类型供外部使用
export * from "./types/index.js";
export {
  matchKeywords,
  structureMessages,
} from "./modules/communication/message-structurer.js";
