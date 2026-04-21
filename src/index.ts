/**
 * 多Agent协同会议系统 - Plugin入口
 *
 * @packageDocumentation
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { hasDatabaseConfig, setStorageConfig } from "./modules/meeting/storage.js";

// 会议生命周期工具
import { createMeetingCreateTool } from "./tools/meeting-create.js";
import { createMeetingStartReadinessTool } from "./tools/meeting-start-readiness.js";
import { createMeetingStartTool } from "./tools/meeting-start.js";
import { createMeetingEndTool } from "./tools/meeting-end.js";
import { createMeetingGetTool } from "./tools/meeting-get.js";
import { createMeetingListTool } from "./tools/meeting-list.js";

// 议程管理工具
import {
  createAgendaAddItemTool,
  createAgendaConfirmTool,
  createAgendaListItemsTool,
  createAgendaNextItemTool,
  createAgendaRemoveItemTool,
  createAgendaReorderItemsTool,
  createAgendaUpdateItemTool,
} from "./tools/agenda-tools.js";

// 发言协调工具
import {
  createSpeakingRequestTool,
  createSpeakingGrantTool,
  createSpeakingReleaseTool,
  createSpeakingStatusTool,
} from "./tools/speaking-tools.js";

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
    const resolveRuntimeConfig = (): Record<string, unknown> => {
      const apiAny = api as unknown as {
        config?: unknown;
        getConfig?: (...args: unknown[]) => unknown;
      };

      const isObject = (v: unknown): v is Record<string, unknown> =>
        Boolean(v) && typeof v === "object" && !Array.isArray(v);

      const pickDirect = (obj: Record<string, unknown>): Record<string, unknown> | undefined => {
        if (typeof obj.pgDsn === "string" || typeof obj.storageDir === "string") {
          return obj;
        }
        return undefined;
      };

      const pickNested = (obj: Record<string, unknown>): Record<string, unknown> | undefined => {
        const config = obj.config;
        if (isObject(config) && (typeof config.pgDsn === "string" || typeof config.storageDir === "string")) {
          return config;
        }

        const entries = obj.entries;
        if (isObject(entries)) {
          const pluginEntry = entries["multi-agent-meeting"];
          if (isObject(pluginEntry) && isObject(pluginEntry.config)) {
            const cfg = pluginEntry.config;
            if (typeof cfg.pgDsn === "string" || typeof cfg.storageDir === "string") {
              return cfg;
            }
          }
        }

        const plugins = obj.plugins;
        if (isObject(plugins) && isObject(plugins.entries)) {
          const pluginEntry = plugins.entries["multi-agent-meeting"];
          if (isObject(pluginEntry) && isObject(pluginEntry.config)) {
            const cfg = pluginEntry.config;
            if (typeof cfg.pgDsn === "string" || typeof cfg.storageDir === "string") {
              return cfg;
            }
          }
        }
        return undefined;
      };

      const candidates: unknown[] = [];
      if (typeof apiAny.getConfig === "function") {
        candidates.push(apiAny.getConfig());
        candidates.push(apiAny.getConfig("multi-agent-meeting"));
      }
      candidates.push(apiAny.config);

      for (const candidate of candidates) {
        if (!isObject(candidate)) {
          continue;
        }
        const picked = pickDirect(candidate) ?? pickNested(candidate);
        if (picked) {
          return picked;
        }
      }
      return {};
    };

    const runtimeConfig = resolveRuntimeConfig();
    const pgDsn = typeof runtimeConfig.pgDsn === "string" ? runtimeConfig.pgDsn : undefined;
    const storageDir = typeof runtimeConfig.storageDir === "string" ? runtimeConfig.storageDir : undefined;
    setStorageConfig({ pgDsn, storageDir });

    const hasPgDsnInConfig = Boolean(pgDsn && pgDsn.trim().length > 0);
    const hasPgDsnInEnv = Boolean(process.env.PG_DSN && process.env.PG_DSN.trim().length > 0);
    api.logger.info(
      `Meeting plugin config check: hasPgDsnInConfig=${hasPgDsnInConfig}, hasPgDsnInEnv=${hasPgDsnInEnv}, hasStorageDirInConfig=${Boolean(storageDir && storageDir.trim().length > 0)}`
    );

    if (!hasDatabaseConfig()) {
      throw new Error(
        hasPgDsnInEnv
          ? "PostgreSQL configuration missing in plugin runtime: PG_DSN exists but plugin cannot read effective pgDsn. Check plugin loading source and runtime config injection."
          : "PostgreSQL configuration missing: set plugin config `pgDsn` (recommended) or environment variable `PG_DSN`."
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

    // 议程管理工具 (7)
    registerTool(createAgendaAddItemTool(api));
    registerTool(createAgendaUpdateItemTool(api));
    registerTool(createAgendaRemoveItemTool(api));
    registerTool(createAgendaReorderItemsTool(api));
    registerTool(createAgendaConfirmTool(api));
    registerTool(createAgendaListItemsTool(api));
    registerTool(createAgendaNextItemTool(api));

    // 发言协调工具 (4)
    registerTool(createSpeakingRequestTool(api));
    registerTool(createSpeakingGrantTool(api));
    registerTool(createSpeakingReleaseTool(api));
    registerTool(createSpeakingStatusTool(api));

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
