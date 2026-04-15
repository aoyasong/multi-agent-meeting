# Multi-Agent Meeting Plugin（OpenClaw）

一个运行在 OpenClaw Gateway 内的原生插件，用于组织多 Agent 协同会议流程，覆盖会议生命周期、议程推进、发言协调、投票决策、记录沉淀、任务分配与产出导出。

## 1. 项目定位

OpenClaw 是一个自托管的 AI Gateway，可以把多个聊天渠道（如 WhatsApp、Telegram、Slack、Discord 等）与 Agent 运行时连接起来，由你自己的机器或服务器统一承载。该插件以 OpenClaw 原生插件方式运行，向 Agent 暴露会议相关工具与命令。

本插件当前插件标识：

- Plugin ID: `multi-agent-meeting-plugin`
- Plugin Name: `Multi-Agent Meeting Plugin`
- Tools: `33` 个
- Commands: `5` 个

## 2. 能力总览

### 2.1 会议生命周期（6）

- `meeting_create`
- `meeting_start_readiness`
- `meeting_start`
- `meeting_end`
- `meeting_get`
- `meeting_list`

### 2.2 议程管理（7）

- `agenda_add_item`
- `agenda_update_item`
- `agenda_remove_item`
- `agenda_reorder_items`
- `agenda_confirm`
- `agenda_list_items`
- `agenda_next_item`

### 2.3 发言协调（4）

- `speaking_request`
- `speaking_grant`
- `speaking_release`
- `speaking_status`

### 2.4 投票决策（5）

- `voting_create`
- `voting_cast`
- `voting_get_result`
- `voting_end`
- `voting_override`

### 2.5 会议记录（3）

- `recording_take_note`
- `recording_tag_insight`
- `recording_get_transcript`

### 2.6 会议产出（3）

- `output_generate_summary`
- `output_generate_action_items`
- `output_export`

### 2.7 任务管理（5）

- `meeting_assign_task`
- `meeting_record_task_result`
- `meeting_get_task`
- `meeting_list_tasks`
- `meeting_update_task_status`

### 2.8 自定义命令（5）

- `/meeting-status`
- `/meeting-list`
- `/meeting-active`
- `/meeting-tasks`
- `/meeting-voting`

## 3. 技术栈与目录

### 3.1 技术栈

- Runtime: `Node.js`（OpenClaw 推荐 Node 24；兼容 Node 22.16+）
- Language: `TypeScript`
- Test: `Vitest`
- SDK: `openclaw/plugin-sdk`

### 3.2 关键目录

```text
src/
  index.ts                     # 插件入口，注册 33 tools + 5 commands
  tools/                       # 各类会议工具实现
  commands/                    # slash 命令实现
  modules/meeting/storage.ts   # 持久化与索引
  modules/communication/       # 消息结构化处理
  types/                       # 领域模型
tests/                         # 合同测试、集成测试、发布冒烟测试
openclaw.plugin.json           # 插件清单与配置 schema
```

## 4. 本地开发

### 4.1 安装与构建

```bash
npm install
npm run build
```

### 4.2 测试

```bash
npm test
```

可选：

```bash
npm run test:coverage
```

### 4.3 常用脚本

- `npm run build`：编译到 `dist/`
- `npm run build:watch`：监听编译
- `npm test`：运行测试
- `npm run lint`：代码检查

## 5. 在 OpenClaw 中加载插件

OpenClaw 插件安装支持本地路径、压缩包或 npm 包。开发阶段建议使用本地 link 方式。

### 5.1 本地开发（推荐）

```bash
# 在插件项目目录执行
openclaw plugins install -l .

# 启用插件
openclaw plugins enable multi-agent-meeting-plugin

# 查看已发现插件
openclaw plugins list --verbose

# 检查插件详情
openclaw plugins inspect multi-agent-meeting-plugin
```

### 5.2 通过 npm 包安装（已发布后）

```bash
openclaw plugins install @openclaw/multi-agent-meeting-plugin
openclaw plugins enable multi-agent-meeting-plugin
```

### 5.3 重启 Gateway

插件安装或配置更新后，重启 Gateway 以确保配置生效：

```bash
openclaw gateway restart
```

## 6. Gateway 配置示例（openclaw.json）

OpenClaw 默认配置路径为 `~/.openclaw/openclaw.json`。下面给出一个可直接参考的插件配置片段：

```json5
{
  plugins: {
    enabled: true,
    // 开发阶段按需使用本地路径加载
    load: {
      paths: ["D:/work/workspace-front/openclaw-support/multi-agent-meeting-plugin"]
    },
    entries: {
      "multi-agent-meeting-plugin": {
        enabled: true,
        config: {
          storageDir: "D:/openclaw/meetings",
          pollIntervalMs: 5000,
          agentTimeoutMs: 30000,
          votingWindows: {
            simple: 180,
            moderate: 300,
            complex: 600
          }
        }
      }
    }
  }
}
```

### 6.1 配置字段约束（来自 `openclaw.plugin.json`）

- `storageDir`: 字符串，会议数据目录（默认 `~/.openclaw/meetings`）
- `pollIntervalMs`: `1000 ~ 30000`，默认 `5000`
- `agentTimeoutMs`: `5000 ~ 120000`，默认 `30000`
- `votingWindows.simple`: 默认 `180`（秒）
- `votingWindows.moderate`: 默认 `300`（秒）
- `votingWindows.complex`: 默认 `600`（秒）

## 7. 数据持久化说明

默认数据目录：`~/.openclaw/meetings`

- 会议元数据：`<storageDir>/<meetingId>/metadata.json`
- 索引文件：`<storageDir>/index.json`
- 会议纪要：`<storageDir>/<meetingId>/summary.json`（由 `output_generate_summary` 生成）
- 导出文件：`summary|transcript|actions.(json|markdown)`

你也可以通过环境变量临时覆盖存储目录：

```bash
MEETING_STORAGE_DIR=D:/tmp/meeting-data
```

## 8. 快速调用流程（建议）

```text
openclaw agents list
  -> 用户选择 participants
meeting_create
  -> agenda_add_item（可多次）
  -> agenda_confirm（用户确认并可修改后执行）
  -> meeting_start_readiness
  -> meeting_start
  -> speaking_request / speaking_grant / speaking_release
  -> recording_take_note
  -> voting_create / voting_cast / voting_end（按需）
  -> output_generate_summary / output_export
  -> meeting_end
```

## 9. 发布到 npm

当前 `package.json` 中配置了 `"private": true`。如果要发布 npm，请先确认并修改该项。

### 9.1 发布前检查

```bash
npm install
npm run build
npm test
```

### 9.2 版本与发布

```bash
npm version patch   # 或 minor / major
npm publish --access public
```

### 9.3 发布后验证

```bash
openclaw plugins install @openclaw/multi-agent-meeting-plugin
openclaw plugins inspect multi-agent-meeting-plugin
openclaw plugins doctor
```

## 10. 质量保障

仓库已覆盖以下测试类型：

- 合同一致性测试：插件清单、工具声明、注册行为一致性
- 模块测试：存储层、工具函数、工具输出结构
- 集成测试：完整会议流程（创建 -> 讨论 -> 投票 -> 纪要 -> 结束）
- 发布冒烟测试：`dist` 可加载、入口一致性、重启后可恢复读取

## 11. 参考文档

- OpenClaw Docs: [https://docs.openclaw.ai/](https://docs.openclaw.ai/)
- 插件管理命令：`openclaw plugins --help`
- 插件文档入口：`openclaw docs` 或官网 `Plugins` 章节
