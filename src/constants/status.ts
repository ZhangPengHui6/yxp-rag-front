import type { Tone } from '@/types'

type Meta = { label: string; tone: Tone }

const JOB: Record<string, Meta> = {
  pending: { label: '排队中', tone: 'muted' },
  running: { label: '解析中', tone: 'info' },
  succeeded: { label: '已完成', tone: 'success' },
  failed: { label: '失败', tone: 'danger' },
  canceled: { label: '已终止', tone: 'muted' }
}

const QUESTION: Record<string, Meta> = {
  draft: { label: '草稿', tone: 'muted' },
  reviewing: { label: '审核中', tone: 'warning' },
  published: { label: '已发布', tone: 'success' },
  archived: { label: '已归档', tone: 'muted' }
}

const TEXTBOOK: Record<string, Meta> = {
  draft: { label: '草稿', tone: 'muted' },
  reviewing: { label: '审核中', tone: 'warning' },
  published: { label: '已发布', tone: 'success' },
  offline: { label: '已下架', tone: 'muted' }
}

const PUBLISH: Record<string, Meta> = {
  draft: { label: '草稿', tone: 'muted' },
  staged: { label: '已暂存', tone: 'warning' },
  published: { label: '已发布', tone: 'success' },
  failed: { label: '失败', tone: 'danger' },
  rolled_back: { label: '已回滚', tone: 'muted' }
}

const EVAL: Record<string, Meta> = {
  passed: { label: '通过', tone: 'success' },
  failed: { label: '未通过', tone: 'danger' },
  running: { label: '评测中', tone: 'info' }
}

const REVIEW: Record<string, Meta> = {
  normal: { label: '常规', tone: 'info' },
  high: { label: '优先', tone: 'danger' }
}

const LICENSE: Record<string, Meta> = {
  valid: { label: '授权有效', tone: 'success' },
  expiring: { label: '即将到期', tone: 'warning' },
  none: { label: '无授权', tone: 'muted' }
}

const ANNOTATION: Record<string, Meta> = {
  pending: { label: '待校对', tone: 'warning' },
  resolved: { label: '已确认', tone: 'success' },
  flagged: { label: '已标记', tone: 'danger' }
}

const MAPS: Record<string, Record<string, Meta>> = {
  job: JOB,
  question: QUESTION,
  textbook: TEXTBOOK,
  publish: PUBLISH,
  eval: EVAL,
  review: REVIEW,
  license: LICENSE,
  annotation: ANNOTATION
}

export function statusMeta(kind: string, status: string): Meta {
  return MAPS[kind]?.[status] ?? { label: status, tone: 'muted' }
}

export const STAGE_LABELS: Record<string, string> = {
  primary: '小学',
  middle: '初中',
  high: '高中'
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage
}
