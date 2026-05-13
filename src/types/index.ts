/**
 * 多Agent协同会议系统 - 类型定义
 * 
 * @packageDocumentation
 */

// 核心实体类型
export type {
  Meeting,
  MeetingType,
  MeetingStatus,
  MeetingTiming,
  MeetingMetadata,
  Participant,
  ParticipantRole,
  ParticipantStatus,
} from './meeting.js';

export type {
  AgendaItem,
  AgendaItemStatus,
  AgendaItemTiming,
  DiscussionEntry,
  ConsensusFeedback,
} from './agenda.js';

export type {
  InterAgentMessage,
} from './communication.js';

export type {
  SpeakingRecord,
  MessageType,
  SpeakingQueueItem,
} from './speaking.js';

export type {
  Voting,
  VotingOption,
  VotingType,
  VotingStatus,
  VotingTiming,
  VotingResult,
  VoteTally,
  Vote,
} from './voting.js';

export type {
  MeetingNote,
  InsightTag,
  MeetingSummary,
  AgendaSummary,
  Perspective,
  Decision,
  ActionItem,
} from './recording.js';

export type {
  PausedMeetingState,
  VotingWindowConfig,
  MeetingConfig,
} from './common.js';

// 任务类型
export type {
  MeetingTask,
  TaskStatus,
  TaskResult,
  TaskStatistics,
  OutputFormat,
} from './task.js';

// 重新导出常量
export { DEFAULT_MEETING_CONFIG, DEFAULT_VOTING_WINDOWS } from './common.js';
