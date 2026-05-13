# Multi-Agent Meeting Plugin v2.0 (for OpenClaw)

An OpenClaw native plugin for orchestrating multi-agent meetings end-to-end. v2.0 introduces host-driven scheduling, topic-level consensus closure, and inter-agent message bridging.

## 1. What This Plugin Is

OpenClaw is a self-hosted AI Gateway that connects channels (WhatsApp, Telegram, Slack, Discord, and more) to agent runtimes on your own machine/server.  
This plugin extends OpenClaw with meeting-specific tools and commands.

Current plugin identity:
- Plugin ID: `multi-agent-meeting`
- Plugin Name: `Multi Agent Meeting`
- Version: `2.0.0`
- Tools: `48`
- Commands: `5`

## 2. Capability Overview (v2.0)

### 2.1 Meeting Lifecycle (6)
- `meeting_create`
- `meeting_start_readiness`
- `meeting_start`
- `meeting_end`
- `meeting_get`
- `meeting_list`

### 2.2 Agenda (10)
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

### 2.3 Speaking Coordination (4)
- `speaking_request`
- `speaking_grant`
- `speaking_release`
- `speaking_status`

### 2.4 Host-Directed Scheduling (3) 🆕
- `speaking_invite` - Host proactively invites specific agent to speak
- `speaking_raise_question` - Directly ask a specific agent
- `speaking_pause_topic` - Pause current topic discussion

### 2.5 Consensus Process (6) 🆕
- `consensus_propose` - Generate consensus proposal
- `consensus_collect_feedback` - Collect feedback from agents
- `consensus_finalize` - Mark topic as resolved with consensus
- `consensus_reopen` - Reopen discussion
- `agenda_get_discussion_progress` - Get discussion progress
- `agenda_escalate_to_arbitration` - Escalate to human arbitration

### 2.6 Inter-Agent Message Bridge (3) 🆕
- `communication_relay_message` - Relay messages between agents
- `communication_list_unresolved_questions` - List pending questions
- `agenda_generate_context_snapshot` - Generate context snapshot

### 2.7 Voting (5)
- `voting_create`
- `voting_cast`
- `voting_get_result`
- `voting_end`
- `voting_override`

### 2.8 Recording (3)
- `recording_take_note`
- `recording_tag_insight`
- `recording_get_transcript`

### 2.9 Output (3)
- `output_generate_summary`
- `output_generate_action_items`
- `output_export`

### 2.10 Task Management (5)
- `meeting_assign_task`
- `meeting_record_task_result`
- `meeting_get_task`
- `meeting_list_tasks`
- `meeting_update_task_status`

### 2.11 Commands (5)
- `/meeting-status`
- `/meeting-list`
- `/meeting-active`
- `/meeting-tasks`
- `/meeting-voting`

## 3. v2.0 Core New Features

### 3.1 Host-Directed Scheduling
No more passive agent speaking requests - the host (primary agent) actively controls the flow:
- Invite specific agents to speak by name
- Direct questions to specific agents
- Pause current topic to discuss others first

### 3.2 Topic-Level Consensus Closure
Independent state tracking for each agenda item:
- `pending` → `discussing` → `consensus_checking` → `resolved`
- Supports discussion rounds, feedback collection
- Escalate to human arbitration when disputes persist

### 3.3 Inter-Agent Message Bridge
Host as single information hub:
- Safely relay critical questions between agents
- Auto-track pending questions list
- Generate context snapshots for new agent onboarding

## 4. Stack and Structure

### 4.1 Stack
- Runtime: `Node.js` (OpenClaw recommends Node 24; Node 22.16+ compatible)
- Language: `TypeScript`
- Test framework: `Vitest`
- SDK: `openclaw/plugin-sdk`
- Storage: `PostgreSQL` (JSONB flexible storage)

### 4.2 Key Paths
```text
src/
  index.ts                     # plugin entry (registers 48 tools + 5 commands)
  tools/                       # tool implementations
    direct-speaking-tools.ts   # host-directed scheduling (new)
    consensus-tools.ts         # consensus process (new)
    communication-tools.ts     # inter-agent messaging (new)
  commands/                    # slash commands
  modules/meeting/storage.ts   # persistence and index
  modules/communication/       # message structuring
  types/                       # domain models
tests/                         # contracts, integration, release smoke tests
  modules/meeting/
    v2-new-features.test.ts    # v2 new feature integration tests
openclaw.plugin.json           # manifest + config schema
```

## 5. Local Development

### 5.1 Install and Build
```bash
npm install
npm run build
```

### 5.2 Test
```bash
npm test
```

Test temp directory notes:
- Default test temp root is `D:/work/Temp` (to avoid writing into the C drive system temp).
- You can override it with `TEST_TMP_ROOT`, for example: `TEST_TMP_ROOT=E:/ci-temp`.

Optional:
```bash
npm run test:coverage
```

### 5.3 Common Scripts
- `npm run build`: Compile to `dist/`
- `npm run build:watch`: Watch and compile
- `npm test`: Run tests
- `npm run lint`: Code linting

## 6. Recommended v2 Flow (Host-Driven)

```text
openclaw agents list
  -> user selects participants
meeting_create
  -> agenda_add_item (repeat, v2 auto-initializes topic state)
  -> agenda_confirm (after user confirms/edits agenda)
  -> meeting_start_readiness
  -> meeting_start
  -> each topic closure:
     ├─ agenda_get_discussion_progress
     ├─ speaking_invite (proactive invitation)
     ├─ speaking_raise_question (directed question)
     ├─ communication_relay_message (optional, relay critical questions)
     ├─ consensus_propose (generate proposal)
     ├─ consensus_collect_feedback (collect feedback)
     ├─ all agree → consensus_finalize
     ├─ too much dissent → consensus_reopen
     ├─ rounds exhausted → agenda_escalate_to_arbitration
     ├─ recording_take_note
     └─ agenda_next_item
  -> output_generate_summary / output_export
  -> meeting_end
```

## 7. Load in OpenClaw

OpenClaw supports installing plugins from local paths, archives, or npm packages.

### 7.1 Local Link Mode (Recommended for Development)
```bash
# run in this plugin directory
openclaw plugins install -l .

openclaw plugins enable multi-agent-meeting
openclaw plugins list --verbose
openclaw plugins inspect multi-agent-meeting
```

### 7.2 Install from npm (after publishing)
```bash
openclaw plugins install @openclaw/multi-agent-meeting-plugin
openclaw plugins enable multi-agent-meeting
```

### 7.3 Restart Gateway
```bash
openclaw gateway restart
```

## 8. Gateway Config Example (`openclaw.json`)

Default config location: `~/.openclaw/openclaw.json`

```json5
{
  plugins: {
    enabled: true,
    // use local path for development
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

Schema constraints (from `openclaw.plugin.json`):
- `pgDsn`: string, PostgreSQL DSN (required)
- `output_base_dir`: string for export files (default `~/.openclaw/meetings`)
- `pollIntervalMs`: `1000 ~ 30000` (default `5000`)
- `agentTimeoutMs`: `5000 ~ 120000` (default `30000`)
- `votingWindows.simple`: default `180` seconds
- `votingWindows.moderate`: default `300` seconds
- `votingWindows.complex`: default `600` seconds

## 9. Persistence

Primary storage backend: PostgreSQL specified by `pgDsn`
- Meeting metadata, index and states: PostgreSQL table `meetings`
- Uses JSONB flexible storage - no extra schema required
- v2 new fields auto-compatible, no ALTER TABLE needed
- Summary file: `<output_base_dir>/<meetingId>/summary.json` (export artifact)
- Export outputs: `summary|transcript|actions.(json|markdown)`

You can override storage in runtime with:
```bash
PG_DSN=postgres://postgres:postgres@127.0.0.1:5432/openclaw_meeting
OUTPUT_BASE_DIR=D:/tmp/meeting-exports
```

## 10. Publish to npm

`package.json` currently contains `"private": true`.  
If you plan to publish, update it before release.

### 10.1 Pre-publish Checks
```bash
npm install
npm run build
npm test
```

### 10.2 Version and Publish
```bash
npm version patch   # or minor / major
npm publish --access public
```

### 10.3 Post-publish Validation
```bash
openclaw plugins install @openclaw/multi-agent-meeting-plugin
openclaw plugins inspect multi-agent-meeting
openclaw plugins doctor
```

## 11. Quality Coverage

The repository includes:
- Contract tests (manifest, tool declaration, registration consistency)
- Module tests (storage, utilities, tool behavior)
- v2 new feature integration tests (consensus flow, host scheduling)
- Integration tests (full meeting lifecycle)
- Release smoke tests (`dist` loadability, runtime registration, restart reliability)

## 12. References

- OpenClaw Docs: [https://docs.openclaw.ai/](https://docs.openclaw.ai/)
- Plugin CLI help: `openclaw plugins --help`
- Plugin documentation: `openclaw docs` or website `Plugins` section

---

## Changelog

### v2.0.0 (2026-05-13)
- ✨ New: Host-directed scheduling tools (3)
- ✨ New: Consensus process toolkit (6)
- ✨ New: Inter-agent message bridge tools (3)
- ✨ New: Topic-level state tracking
- ✨ New: Speaking state persistence (no more memory only)
- 📈 Enhanced: Tools increased from 33 to 48
- 📈 Enhanced: PostgreSQL new indexes for optimized queries
- 🐛 Fixed: storage.ts complete support for v2 new fields
