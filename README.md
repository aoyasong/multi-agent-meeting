# Multi-Agent Meeting Plugin v2.0（OpenClaw）

一个运行在 OpenClaw Gateway 内的原生插件，用于组织多 Agent 协同会议流程。v2.0 支持主持人主动调度、议题级共识闭环、跨 Agent 消息桥接等全新能力。

## 1. 项目定位

OpenClaw 是一个自托管的 AI Gateway，可以把多个聊天渠道（如 WhatsApp、Telegram、Slack、Discord 等）与 Agent 运行时连接起来，由你自己的机器或服务器统一承载。该插件以 OpenClaw 原生插件方式运行，向 Agent 暴露会议相关工具与命令。

本插件当前插件标识：

- Plugin ID: `multi-agent-meeting`
- Plugin Name: `Multi Agent Meeting`
- Version: `2.0.0`
- Tools: `48` 个
- Commands: `5` 个

## 2. 能力总览（v2.0）

### 2.1 会议生命周期（6）
- `meeting_create`
- `meeting_start_readiness`
- `meeting_start`
- `meeting_end`
- `meeting_get`
- `meeting_list`

### 2.2 议程管理（10）
- `agenda_add_item`
- `agenda_update_item`
- `agenda_remove_item`
- `agenda_reorder_items`
- `agenda_confirm`
- `agenda_list_items`
- `agenda_next_item`
- `agenda_attach_task`
- `participant_confirm_received`
- `agenda_dashboard`

### 2.3 发言协调（4）
- `speaking_request`
- `speaking_grant`
- `speaking_release`
- `speaking_status`

### 2.4 主持人主动调度（3）🆕
- `speaking_invite` - 主持人主动点名邀请
- `speaking_raise_question` - 定向抛出问题
- `speaking_pause_topic` - 暂停议题讨论

### 2.5 共识流程工具（6）🆕
- `consensus_propose` - 生成共识提案
- `consensus_collect_feedback` - 收集反馈
- `consensus_finalize` - 标记达成共识
- `consensus_reopen` - 重开讨论
- `agenda_get_discussion_progress` - 获取讨论进度
- `agenda_escalate_to_arbitration` - 升级仲裁

### 2.6 跨Agent消息桥接（3）🆕
- `communication_relay_message` - 中转消息
- `communication_list_unresolved_questions` - 查看未决问题
- `agenda_generate_context_snapshot` - 生成上下文快照

### 2.7 投票决策（5）
- `voting_create`
- `voting_cast`
- `voting_get_result`
- `voting_end`
- `voting_override`

### 2.8 会议记录（3）
- `recording_take_note`
- `recording_tag_insight`
- `recording_get_transcript`

### 2.9 会议产出（3）
- `output_generate_summary`
- `output_generate_action_items`
- `output_export`

### 2.10 任务管理（5）
- `meeting_assign_task`
- `meeting_record_task_result`
- `meeting_get_task`
- `meeting_list_tasks`
- `meeting_update_task_status`

### 2.11 自定义命令（5）
- `/meeting-status`
- `/meeting-list`
- `/meeting-active`
- `/meeting-tasks`
- `/meeting-voting`

## 3. v2.0 核心新特性

### 3.1 主持人主动调度模式
不再是 Agent 被动申请发言，由主持人（主 Agent）主动控制流程：
- 点名邀请特定 Agent 发言
- 定向抛出问题给指定 Agent
- 可暂停当前议题，先讨论其他问题

### 3.2 议题级共识闭环
每个议题独立状态追踪：
- `pending` → `discussing` → `consensus_checking` → `resolved`
- 支持讨论轮次、反馈收集
- 分歧过大可升级用户仲裁

### 3.3 跨Agent消息桥接
主持人作为唯一信息中枢：
- 安全中转 Agent 间关键问题
- 自动记录未决问题清单
- 生成上下文快照供新 Agent 快速理解

## 4. 技术栈与目录

### 4.1 技术栈
- Runtime: `Node.js`（OpenClaw 推荐 Node 24；兼容 Node 22.16+）
- Language: `TypeScript`
- Test: `Vitest`
- SDK: `openclaw/plugin-sdk`
- Storage: `PostgreSQL`（JSONB 灵活存储）

### 4.2 关键目录
```text
src/
  index.ts                     # 插件入口，注册 48 tools + 5 commands
  tools/                       # 各类会议工具实现
    direct-speaking-tools.ts   # 主持人主动调度（新）
    consensus-tools.ts         # 共识流程（新）
    communication-tools.ts     # 跨Agent消息（新）
  commands/                    # slash 命令实现
  modules/meeting/storage.ts   # 持久化与索引
  modules/communication/       # 消息结构化处理
  types/                       # 领域模型
tests/                         # 合同测试、集成测试、发布冒烟测试
  modules/meeting/
    v2-new-features.test.ts    # v2 新功能集成测试
openclaw.plugin.json           # 插件清单与配置 schema
```

## 5. 本地开发

### 5.1 安装与构建
```bash
npm install
npm run build
```

### 5.2 测试
```bash
npm test
```

测试临时目录说明：
- 默认使用 `D:/work/Temp` 作为测试临时数据根目录（避免写入 C 盘系统临时目录）。
- 如需覆盖，可设置环境变量 `TEST_TMP_ROOT`，例如：`TEST_TMP_ROOT=E:/ci-temp`。

可选：
```bash
npm run test:coverage
```

### 5.3 常用脚本
- `npm run build`：编译到 `dist/`
- `npm run build:watch`：监听编译
- `npm test`：运行测试
- `npm run lint`：代码检查

## 6. v2 推荐调用流程（主持人主导）

```text
openclaw agents list
  -> 用户选择 participants
meeting_create
  -> agenda_add_item（可多次，v2 自动初始化议题状态）
  -> agenda_confirm（用户确认并可修改后执行）
  -> meeting_start_readiness
  -> meeting_start
  -> 每个议题闭环：
     ├─ agenda_get_discussion_progress
     ├─ speaking_invite（主动点名）
     ├─ speaking_raise_question（定向提问）
     ├─ communication_relay_message（可选，中转关键问题）
     ├─ consensus_propose（生成提案）
     ├─ consensus_collect_feedback（逐个收集反馈）
     ├─ 全部同意 → consensus_finalize
     ├─ 异议太大 → consensus_reopen
     ├─ 轮次耗尽 → agenda_escalate_to_arbitration
     ├─ recording_take_note
     └─ agenda_next_item
  -> output_generate_summary / output_export
  -> meeting_end
```

## 7. 在 OpenClaw 中加载插件

OpenClaw 插件安装支持本地路径、压缩包或 npm 包。开发阶段建议使用本地 link 方式。

### 7.1 本地开发（推荐）
```bash
# 在插件项目目录执行
openclaw plugins install -l .

# 启用插件
openclaw plugins enable multi-agent-meeting

# 查看已发现插件
openclaw plugins list --verbose

# 检查插件详情
openclaw plugins inspect multi-agent-meeting
```

### 7.2 通过 npm 包安装（已发布后）
```bash
openclaw plugins install @openclaw/multi-agent-meeting-plugin
openclaw plugins enable multi-agent-meeting
```

### 7.3 重启 Gateway
插件安装或配置更新后，重启 Gateway 以确保配置生效：
```bash
openclaw gateway restart
```

## 8. Gateway 配置示例（openclaw.json）

OpenClaw 默认配置路径为 `~/.openclaw/openclaw.json`。下面给出一个可直接参考的插件配置片段：

```json5
{
  plugins: {
    enabled: true,
    // 开发阶段按需使用本地路径加载
    load: {
      paths: ["D:/work/workspace-front/openclaw-support/multi-agent-meeting"]
    },
    entries: {
      "multi-agent-meeting": {
        enabled: true,
        config: {
          pgDsn: "postgres://postgres:postgres@127.0.0.1:5432/openclaw_meeting",
          output_base_dir: "D:/openclaw/meetings-exports",
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

### 8.1 配置字段约束（来自 `openclaw.plugin.json`）
- `pgDsn`: 字符串，PostgreSQL 连接串（必填）
- `output_base_dir`: 字符串，导出文件目录（默认 `~/.openclaw/meetings`）
- `pollIntervalMs`: `1000 ~ 30000`，默认 `5000`
- `agentTimeoutMs`: `5000 ~ 120000`，默认 `30000`
- `votingWindows.simple`: 默认 `180`（秒）
- `votingWindows.moderate`: 默认 `300`（秒）
- `votingWindows.complex`: 默认 `600`（秒）

## 9. 数据持久化说明

默认数据库：`pgDsn` 指向的 PostgreSQL 实例
- 会议元数据、索引与状态：存储于 PostgreSQL（表 `meetings`）
- 数据库使用 JSONB 灵活存储，无需额外表结构
- v2 新增字段自动兼容，无需 ALTER TABLE
- 会议纪要：`<output_base_dir>/<meetingId>/summary.json`（由 `output_generate_summary` 生成，导出文件）
- 导出文件：`summary|transcript|actions.(json|markdown)`

你也可以通过环境变量临时覆盖存储目录：
```bash
PG_DSN=postgres://postgres:postgres@127.0.0.1:5432/openclaw_meeting
OUTPUT_BASE_DIR=D:/tmp/meeting-exports
```

## 10. 发布到 npm

当前 `package.json` 中配置了 `"private": true`。如果要发布 npm，请先确认并修改该项。

### 10.1 发布前检查
```bash
npm install
npm run build
npm test
```

### 10.2 版本与发布
```bash
npm version patch   # 或 minor / major
npm publish --access public
```

### 10.3 发布后验证
```bash
openclaw plugins install @openclaw/multi-agent-meeting-plugin
openclaw plugins inspect multi-agent-meeting
openclaw plugins doctor
```

## 11. 质量保障

仓库已覆盖以下测试类型：
- 合同一致性测试：插件清单、工具声明、注册行为一致性
- 模块测试：存储层、工具函数、工具输出结构
- v2 新功能集成测试：完整共识流程、主动调度
- 集成测试：完整会议流程（创建 → 讨论 → 共识 → 纪要 → 结束）
- 发布冒烟测试：`dist` 可加载、入口一致性、重启后可恢复读取

## 12. 参考文档

- OpenClaw Docs: [https://docs.openclaw.ai/](https://docs.openclaw.ai/)
- 插件管理命令：`openclaw plugins --help`
- 插件文档入口：`openclaw docs` 或官网 `Plugins` 章节

---

## 更新日志

### v2.0.0 (2026-05-13)
- ✨ 新增：主持人主动调度工具（3个）
- ✨ 新增：共识流程工具集（6个）
- ✨ 新增：跨Agent消息桥接工具（3个）
- ✨ 新增：议题级状态追踪
- ✨ 新增：发言状态持久化（不再依赖内存）
- 📈 扩展：工具总数从 33 提升到 48
- 📈 扩展：PostgreSQL 新增索引支持优化查询
- 🐛 修复：storage.ts 完整支持 v2 新字段
