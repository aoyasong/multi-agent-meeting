# Multi-Agent Meeting Plugin (for OpenClaw)

An OpenClaw native plugin for orchestrating multi-agent meetings end-to-end: meeting lifecycle, agenda flow, speaking coordination, voting, recording, task assignment, and output export.

## 1. What This Plugin Is

OpenClaw is a self-hosted AI Gateway that connects channels (WhatsApp, Telegram, Slack, Discord, and more) to agent runtimes on your own machine/server.  
This plugin extends OpenClaw with meeting-specific tools and commands.

Current plugin identity:

- Plugin ID: `multi-agent-meeting-plugin`
- Plugin Name: `Multi-Agent Meeting Plugin`
- Tools: `33`
- Commands: `5`

## 2. Capability Overview

### 2.1 Meeting Lifecycle (6)

- `meeting_create`
- `meeting_start_readiness`
- `meeting_start`
- `meeting_end`
- `meeting_get`
- `meeting_list`

### 2.2 Agenda (7)

- `agenda_add_item`
- `agenda_update_item`
- `agenda_remove_item`
- `agenda_reorder_items`
- `agenda_confirm`
- `agenda_list_items`
- `agenda_next_item`

### 2.3 Speaking Coordination (4)

- `speaking_request`
- `speaking_grant`
- `speaking_release`
- `speaking_status`

### 2.4 Voting (5)

- `voting_create`
- `voting_cast`
- `voting_get_result`
- `voting_end`
- `voting_override`

### 2.5 Recording (3)

- `recording_take_note`
- `recording_tag_insight`
- `recording_get_transcript`

### 2.6 Output (3)

- `output_generate_summary`
- `output_generate_action_items`
- `output_export`

### 2.7 Task Management (5)

- `meeting_assign_task`
- `meeting_record_task_result`
- `meeting_get_task`
- `meeting_list_tasks`
- `meeting_update_task_status`

### 2.8 Commands (5)

- `/meeting-status`
- `/meeting-list`
- `/meeting-active`
- `/meeting-tasks`
- `/meeting-voting`

## 3. Stack and Structure

### 3.1 Stack

- Runtime: `Node.js` (OpenClaw recommends Node 24; Node 22.16+ compatible)
- Language: `TypeScript`
- Test framework: `Vitest`
- SDK: `openclaw/plugin-sdk`

### 3.2 Key Paths

```text
src/
  index.ts                     # plugin entry (registers 33 tools + 5 commands)
  tools/                       # tool implementations
  commands/                    # slash commands
  modules/meeting/storage.ts   # persistence and index
  modules/communication/       # message structuring
  types/                       # domain models
tests/                         # contracts, integration, release smoke tests
openclaw.plugin.json           # manifest + config schema
```

## 4. Local Development

### 4.1 Install and Build

```bash
npm install
npm run build
```

### 4.2 Test

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

## 5. Load in OpenClaw

OpenClaw supports installing plugins from local paths, archives, or npm packages.

### 5.1 Local Link Mode (Recommended for Development)

```bash
# run in this plugin directory
openclaw plugins install -l .

openclaw plugins enable multi-agent-meeting-plugin
openclaw plugins list --verbose
openclaw plugins inspect multi-agent-meeting-plugin
```

### 5.2 Install from npm (after publishing)

```bash
openclaw plugins install @openclaw/multi-agent-meeting-plugin
openclaw plugins enable multi-agent-meeting-plugin
```

### 5.3 Restart Gateway

```bash
openclaw gateway restart
```

## 6. Gateway Config Example (`openclaw.json`)

Default config location: `~/.openclaw/openclaw.json`

```json5
{
  plugins: {
    enabled: true,
    load: {
      paths: ["D:/work/workspace-front/openclaw-support/multi-agent-meeting-plugin"]
    },
    entries: {
      "multi-agent-meeting-plugin": {
        enabled: true,
        config: {
          pgDsn: "postgres://postgres:postgres@127.0.0.1:5432/openclaw_meeting",
          storageDir: "D:/openclaw/meetings-exports",
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
- `storageDir`: string for export files (default `~/.openclaw/meetings`)
- `pollIntervalMs`: `1000 ~ 30000` (default `5000`)
- `agentTimeoutMs`: `5000 ~ 120000` (default `30000`)
- `votingWindows.simple`: default `180` seconds
- `votingWindows.moderate`: default `300` seconds
- `votingWindows.complex`: default `600` seconds

## 7. Persistence

Primary storage backend: PostgreSQL specified by `pgDsn`

- Meeting metadata, index and states: PostgreSQL table `meetings`
- SQL bootstrap script: `docs/postgres-schema.sql`
- Summary file: `<storageDir>/<meetingId>/summary.json` (export artifact)
- Export outputs: `summary|transcript|actions.(json|markdown)`

You can override storage in runtime with:

```bash
PG_DSN=postgres://postgres:postgres@127.0.0.1:5432/openclaw_meeting
MEETING_STORAGE_DIR=D:/tmp/meeting-exports
```

## 8. Suggested Tool Flow

```text
openclaw agents list
  -> user selects participants
meeting_create
  -> agenda_add_item (repeat as needed)
  -> agenda_confirm (after user confirms/edits agenda)
  -> meeting_start_readiness
  -> meeting_start
  -> speaking_request / speaking_grant / speaking_release
  -> recording_take_note
  -> voting_create / voting_cast / voting_end (optional)
  -> output_generate_summary / output_export
  -> meeting_end
```

## 9. Publish to npm

`package.json` currently contains `"private": true`.  
If you plan to publish, update it before release.

### 9.1 Pre-publish Checks

```bash
npm install
npm run build
npm test
```

### 9.2 Version and Publish

```bash
npm version patch   # or minor / major
npm publish --access public
```

### 9.3 Post-publish Validation

```bash
openclaw plugins install @openclaw/multi-agent-meeting-plugin
openclaw plugins inspect multi-agent-meeting-plugin
openclaw plugins doctor
```

## 10. Quality Coverage

The repository includes:

- Contract tests (manifest, tool declaration, registration consistency)
- Module tests (storage, utilities, tool behavior)
- Integration tests (full meeting lifecycle)
- Release smoke tests (`dist` loadability, runtime registration, restart reliability)

## 11. References

- OpenClaw Docs: [https://docs.openclaw.ai/](https://docs.openclaw.ai/)
- Plugin CLI help: `openclaw plugins --help`
