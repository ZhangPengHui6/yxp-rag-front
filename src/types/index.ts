export type Stage = 'primary' | 'middle' | 'high'
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'muted'

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface User {
  id: string
  username: string
  name: string
  role: string
  roleName: string
  permissions: string[]
  tenant: string
  lastLoginAt: string
}

export interface Empty {}

export interface DashboardMetric {
  key: string
  label: string
  value: string
  note: string
  tone: Tone
}

export interface TodoItem {
  id: string
  kind: 'annotation' | 'review' | 'failed_job' | 'coverage'
  title: string
  count: number
  tone: Tone
}

export interface DashboardSummary {
  metrics: DashboardMetric[]
  todos: TodoItem[]
  trend: { date: string; ingested: number; published: number }[]
}

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'

export interface JobStep {
  key: string
  label: string
  status: 'done' | 'running' | 'pending' | 'failed'
  detail?: string
}

export interface IngestionJob {
  id: string
  name: string
  sourceType: 'PDF' | 'DOCX' | 'IMAGE' | 'ZIP'
  subject: string
  stage: Stage
  pages: number
  sizeMb: number
  progress: number
  status: JobStatus
  steps: JobStep[]
  createdAt: string
  error?: string
}

export interface Chapter {
  id: string
  no: number
  title: string
  page: number
  questionCount: number
}

export interface Textbook {
  id: string
  title: string
  edition: string
  subject: string
  stage: Stage
  chapters: Chapter[]
  pageCount: number
  status: 'draft' | 'reviewing' | 'published' | 'offline'
  license: { holder: string; scope: string; expiresAt: string; status: 'valid' | 'expiring' | 'none' }
  updatedAt: string
}

export interface Question {
  id: string
  stem: string
  type: '选择题' | '填空题' | '解答题'
  difficulty: '易' | '中' | '难'
  knowledgePoints: string[]
  source: string
  stage: Stage
  subject: string
  status: 'draft' | 'reviewing' | 'published' | 'archived'
  answer: string
  analysis: string
  options?: { key: string; text: string }[]
  updatedAt: string
}

export interface KnowledgeNode {
  id: string
  name: string
  level: number
  questionCount: number
  coverage: number
  status: 'published' | 'draft'
  children?: KnowledgeNode[]
}

export interface KnowledgeDetail {
  node: KnowledgeNode
  code: string
  path: string
  stats: { questions: number; paragraphs: number; coverage: number; prerequisites: number }
  evidences: { book: string; location: string; excerpt: string; edition: string }[]
  distribution: { label: string; count: number; percent: number }[]
  relations: { type: '前置' | '后继'; items: string[] }[]
  pitfalls: string[]
}

export interface AnnotationBlock {
  id: string
  index: number
  type: '标题' | '正文' | '公式' | '表格' | '图注'
  content: string
  confidence: number
  status: 'pending' | 'resolved' | 'flagged'
}

export interface AnnotationTask {
  id: string
  book: string
  chapter: string
  page: number
  pageTotal: number
  cursor: number
  total: number
  blocks: AnnotationBlock[]
}

export type ReviewKind = '题目' | '知识点' | '教材'

export interface ReviewTask {
  id: string
  kind: ReviewKind
  title: string
  submitter: string
  submittedAt: string
  priority: 'normal' | 'high'
  payload: {
    stem?: string
    formula?: string
    answer?: string
    analysis?: string
    knowledgePoints?: string[]
    confidence?: number
    source?: string
    changeNote?: string
  }
}

export type PublishStatus = 'draft' | 'staged' | 'published' | 'failed' | 'rolled_back'

export interface PublishOrder {
  id: string
  status: PublishStatus
  target: string
  createdAt: string
  createdBy: string
  alias: { chunks: string; questions: string }
  changes: { label: string; value: string; tone: Tone }[]
  checks: { label: string; detail: string; passed: boolean }[]
  stages: { key: string; title: string; description: string; status: 'done' | 'running' | 'pending' | 'failed' }[]
  note?: string
}

export interface EvalRun {
  id: string
  dataset: string
  model: string
  recall: number
  accuracy: number
  status: 'passed' | 'failed' | 'running'
  createdAt: string
}

export interface EvalReport {
  runId: string
  createdAt: string
  metrics: { label: string; value: number; display: string }[]
  failures: { question: string; reason: string; tone: Tone }[]
}

export interface AuditLog {
  id: string
  actor: string
  action: string
  target: string
  ip: string
  createdAt: string
}

export interface Tenant {
  id: string
  name: string
  plan: string
  users: number
  status: 'active' | 'suspended'
}

export interface RoleRow {
  code: string
  name: string
  description: string
  userCount: number
  permissionCount: number
}
