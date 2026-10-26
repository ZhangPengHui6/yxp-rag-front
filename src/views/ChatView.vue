<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound,
  CopyDocument,
  Delete,
  Promotion,
  WarningFilled
} from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { fetchKbHealth, streamKbChat } from '@/api/kb'
import type {
  KbCitation,
  KbHealth,
  KbHistoryMessage,
  KbRetrievalStats
} from '@/api/kb'

type Confidence = '' | 'high' | 'medium' | 'low'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: KbCitation[]
  requestId: string
  rewrittenQuery: string
  rerankProvider: string
  retrieval: KbRetrievalStats | null
  confidence: Confidence
  model: string
  latencyMs: number
  error: string
  streaming: boolean
  stopped: boolean
}

interface Segment {
  type: 'text' | 'cite' | 'bold'
  value: string
  index?: number
}

const SUGGESTIONS = [
  '圆锥的体积公式是什么？',
  '球的表面积和体积怎么计算？',
  '函数 y=3sin(2x+π/4) 的周期和振幅是多少？',
  '求函数 f(x)=x³-3x 的极值'
]

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: '单选题',
  fill_blank: '填空题',
  solution: '解答题'
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: '高置信',
  medium: '中置信',
  low: '低置信'
}

const STAGE_LABELS: Record<string, string> = {
  high: '高中',
  junior: '初中',
  primary: '小学'
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '易',
  medium: '中',
  hard: '难'
}

const messages = ref<ChatMessage[]>([])
const input = ref('')
const streaming = ref(false)
const subject = ref('')
const stage = ref('')
const activeMsgId = ref('')
const activeCitation = ref(0)
const expanded = ref<number[]>([])
const logRef = ref<HTMLElement>()
const controller = ref<AbortController | null>(null)
const health = ref<KbHealth | null>(null)
const healthError = ref('')

let seq = 0
function uid(prefix: string): string {
  seq += 1
  return `${prefix}_${Date.now()}_${seq}`
}

const canSend = computed(() => input.value.trim().length > 0 && !streaming.value)

const activeMessage = computed<ChatMessage | null>(() => {
  if (activeMsgId.value) {
    const found = messages.value.find((item) => item.id === activeMsgId.value)
    if (found) return found
  }
  const assistants = messages.value.filter((item) => item.role === 'assistant')
  return assistants.length ? assistants[assistants.length - 1] : null
})

const activeCitations = computed(() => activeMessage.value?.citations ?? [])
const activeRetrieval = computed(() => activeMessage.value?.retrieval ?? null)
const activeConfidence = computed(() => activeMessage.value?.confidence ?? '')
const activeRewritten = computed(() => activeMessage.value?.rewrittenQuery ?? '')
const activeRerank = computed(() => activeMessage.value?.rerankProvider ?? '')
const activeRequestId = computed(() => activeMessage.value?.requestId ?? '')

onMounted(loadHealth)

async function loadHealth() {
  try {
    health.value = await fetchKbHealth()
    healthError.value = ''
  } catch (error) {
    healthError.value = (error as Error).message
  }
}

function historyFor(): KbHistoryMessage[] {
  return messages.value
    .filter((item) => item.content.trim() && !item.error)
    .slice(-6)
    .map((item) => ({ role: item.role, content: item.content }))
}

async function send(text?: string) {
  const query = (text ?? input.value).trim()
  if (!query || streaming.value) return

  const history = historyFor()
  input.value = ''
  expanded.value = []
  activeCitation.value = 0

  const userMessage: ChatMessage = {
    id: uid('m'),
    role: 'user',
    content: query,
    citations: [],
    requestId: '',
    rewrittenQuery: '',
    rerankProvider: '',
    retrieval: null,
    confidence: '',
    model: '',
    latencyMs: 0,
    error: '',
    streaming: false,
    stopped: false
  }
  const assistant: ChatMessage = {
    ...userMessage,
    id: uid('m'),
    role: 'assistant',
    citations: []
  }
  messages.value.push(userMessage, assistant)
  activeMsgId.value = assistant.id
  streaming.value = true
  controller.value = new AbortController()
  scrollToBottom()

  try {
    await streamKbChat(
      {
        query,
        messages: history,
        subject: subject.value || undefined,
        stage: stage.value || undefined
      },
      {
        meta: (data) => {
          assistant.retrieval = data.retrieval
          assistant.rewrittenQuery = data.rewritten_query
          assistant.rerankProvider = data.rerank_provider
          assistant.requestId = data.request_id
        },
        citation: (data) => {
          assistant.citations.push(data)
        },
        delta: (data) => {
          assistant.content += data.delta
          scrollToBottom()
        },
        done: (data) => {
          assistant.confidence = data.confidence
          assistant.model = data.model
          assistant.latencyMs = data.latency_ms
          assistant.requestId = data.request_id || assistant.requestId
        },
        error: (data) => {
          assistant.error = data.message
        }
      },
      controller.value.signal
    )
  } catch (error) {
    if ((error as Error).name === 'AbortError') assistant.stopped = true
    else assistant.error = (error as Error).message || '请求失败'
  } finally {
    assistant.streaming = false
    streaming.value = false
    controller.value = null
    scrollToBottom()
  }
}

function stop() {
  controller.value?.abort()
}

function clearChat() {
  if (streaming.value) stop()
  messages.value = []
  activeMsgId.value = ''
  activeCitation.value = 0
  expanded.value = []
}

function scrollToBottom() {
  nextTick(() => {
    const element = logRef.value
    if (element) element.scrollTop = element.scrollHeight
  })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  if (!streaming.value) void send()
}

function segments(text: string): Segment[] {
  const parts: Segment[] = []
  const pattern = /\[(\d+)\]|\*\*([^*\n]+)\*\*/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) })
    if (match[1]) {
      parts.push({ type: 'cite', value: match[0], index: Number(match[1]) })
    } else {
      parts.push({ type: 'bold', value: match[2] })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

function citationIndex(citation: KbCitation): number {
  const digits = citation.citation_id.replace(/\D/g, '')
  return Number(digits) || 0
}

function focusCitation(message: ChatMessage, index: number) {
  activeMsgId.value = message.id
  activeCitation.value = index
  nextTick(() => {
    document
      .querySelector(`[data-cite="${index}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

function focusMessage(message: ChatMessage) {
  activeMsgId.value = message.id
  activeCitation.value = message.citations.length ? 1 : 0
}

function toggleQuote(index: number) {
  expanded.value = expanded.value.includes(index)
    ? expanded.value.filter((item) => item !== index)
    : [...expanded.value, index]
}

function citationTitle(citation: KbCitation): string {
  if (citation.source === 'question') {
    return QUESTION_TYPE_LABELS[citation.question_type] || '练习题'
  }
  return citation.book_title || '教材片段'
}

function citationMeta(citation: KbCitation): string {
  const parts: string[] = []
  if (citation.subject) parts.push(citation.subject)
  if (citation.stage) parts.push(stageLabel(citation.stage))
  if (citation.source === 'question') {
    if (citation.difficulty) parts.push(`难度 ${difficultyLabel(citation.difficulty)}`)
  } else if (citation.page_start) {
    parts.push(`第 ${citation.page_start} 页`)
  }
  return parts.join(' · ')
}

function stageLabel(value: string): string {
  return STAGE_LABELS[value] || value
}

function difficultyLabel(value: string): string {
  return DIFFICULTY_LABELS[value] || value
}

function confidenceLabel(value: string): string {
  return CONFIDENCE_LABELS[value] || value
}

function confidenceType(value: string): 'success' | 'warning' | 'info' {
  if (value === 'high') return 'success'
  if (value === 'medium') return 'warning'
  return 'info'
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

async function copyAnswer(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制回答')
  } catch {
    ElMessage.warning('浏览器不允许访问剪贴板')
  }
}
</script>

<template>
  <div class="chat-page">
    <PageHeader title="学员问答" subtitle="基于已发布教材与题目的实时检索问答（kb-api /v1）">
      <template #actions>
        <el-tag v-if="health" :type="health.status === 'ok' ? 'success' : 'warning'" effect="plain" round>
          知识库 {{ health.chunks }} 片段 · {{ health.questions }} 题
        </el-tag>
        <el-tag v-else-if="healthError" type="danger" effect="plain" round>服务未连接</el-tag>
        <el-button :icon="Delete" plain :disabled="!messages.length" @click="clearChat">清空对话</el-button>
      </template>
    </PageHeader>

    <div v-if="healthError" class="service-warning">
      <el-icon><WarningFilled /></el-icon>
      <span>未能连接知识库服务：{{ healthError }}。请确认 apps/kb-api 已在 8001 端口启动。</span>
      <el-button link type="primary" @click="loadHealth">重试</el-button>
    </div>

    <div class="chat-shell">
      <section class="chat-main">
        <div class="chat-top">
          <div class="chat-title">
            <span class="chat-icon"><el-icon><ChatDotRound /></el-icon></span>
            <div>
              <strong>教材问答</strong>
              <small>检索 → 重排 → 生成，回答附教材出处</small>
            </div>
          </div>
          <div class="chat-filters">
            <el-select v-model="subject" size="small" placeholder="全部学科" clearable style="width: 104px">
              <el-option label="数学" value="数学" />
              <el-option label="物理" value="物理" />
              <el-option label="化学" value="化学" />
            </el-select>
            <el-select v-model="stage" size="small" placeholder="全部学段" clearable style="width: 104px">
              <el-option label="高中" value="high" />
              <el-option label="初中" value="junior" />
              <el-option label="小学" value="primary" />
            </el-select>
          </div>
        </div>

        <div ref="logRef" class="chat-log">
          <div v-if="!messages.length" class="welcome">
            <div class="welcome-mark">Y</div>
            <h2>今天想弄懂哪个知识点？</h2>
            <p>回答只依据已发布的教材片段与练习题，并标注出处页码。</p>
            <div class="suggestions">
              <button v-for="item in SUGGESTIONS" :key="item" class="suggestion" type="button" @click="send(item)">
                {{ item }}
              </button>
            </div>
          </div>

          <div v-for="message in messages" :key="message.id" class="row" :class="message.role">
            <div v-if="message.role === 'assistant'" class="avatar">助</div>
            <div class="bubble">
              <div class="bubble-text">
                <template v-for="(part, position) in segments(message.content)" :key="position">
                  <button
                    v-if="part.type === 'cite'"
                    class="cite-chip"
                    type="button"
                    @click="focusCitation(message, part.index || 0)"
                  >{{ part.value }}</button>
                  <strong v-else-if="part.type === 'bold'">{{ part.value }}</strong>
                  <span v-else>{{ part.value }}</span>
                </template>
                <span v-if="message.streaming && !message.content" class="thinking">
                  <i /><i /><i /> 正在检索资料
                </span>
                <span v-else-if="message.streaming" class="caret" />
              </div>

              <div v-if="message.error" class="msg-error">
                <el-icon><WarningFilled /></el-icon>
                <span>{{ message.error }}</span>
              </div>
              <div v-else-if="message.stopped" class="msg-note">已停止生成</div>

              <div v-if="message.role === 'assistant' && (message.citations.length || message.model)" class="msg-foot">
                <button
                  v-if="message.citations.length"
                  class="foot-link"
                  type="button"
                  @click="focusMessage(message)"
                >{{ message.citations.length }} 条引用</button>
                <span v-if="message.confidence" class="foot-dot">·</span>
                <span v-if="message.confidence">{{ confidenceLabel(message.confidence) }}</span>
                <span v-if="message.latencyMs" class="foot-dot">·</span>
                <span v-if="message.latencyMs">{{ seconds(message.latencyMs) }}</span>
                <span class="foot-grow" />
                <button class="foot-link" type="button" @click="copyAnswer(message.content)">
                  <el-icon><CopyDocument /></el-icon>复制
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="composer">
          <el-input
            v-model="input"
            type="textarea"
            resize="none"
            :autosize="{ minRows: 1, maxRows: 5 }"
            placeholder="输入你的问题，例如：圆锥的侧面积怎么求？"
            @keydown="onKeydown"
          />
          <div class="composer-foot">
            <span class="hint">Enter 发送 · Shift + Enter 换行</span>
            <el-button
              v-if="!streaming"
              type="primary"
              :icon="Promotion"
              :disabled="!canSend"
              @click="send()"
            >发送</el-button>
            <el-button v-else type="danger" plain @click="stop">停止生成</el-button>
          </div>
        </div>
      </section>

      <aside class="evidence">
        <div class="evidence-head">
          <div class="evidence-title">引用与检索</div>
          <el-tag
            v-if="activeConfidence"
            :type="confidenceType(activeConfidence)"
            size="small"
            effect="plain"
          >{{ confidenceLabel(activeConfidence) }}</el-tag>
        </div>

        <div v-if="activeRewritten" class="rewritten">
          <span>检索词</span>
          <p>{{ activeRewritten }}</p>
        </div>

        <div v-if="activeRetrieval" class="stats">
          <div class="stat">
            <span>教材向量</span>
            <strong>{{ activeRetrieval.dense }}</strong>
          </div>
          <div class="stat">
            <span>题目命中</span>
            <strong>{{ activeRetrieval.questions }}</strong>
          </div>
          <div class="stat">
            <span>融合候选</span>
            <strong>{{ activeRetrieval.fused }}</strong>
          </div>
          <div class="stat">
            <span>最终引用</span>
            <strong>{{ activeRetrieval.reranked }}</strong>
          </div>
        </div>

        <div class="evidence-list">
          <article
            v-for="citation in activeCitations"
            :key="citation.citation_id"
            class="cite-card"
            :class="{ active: activeCitation === citationIndex(citation) }"
            :data-cite="citationIndex(citation)"
            @click="activeCitation = citationIndex(citation)"
          >
            <div class="cite-head">
              <span class="cite-index">{{ citation.citation_id }}</span>
              <span class="cite-source" :class="citation.source">
                {{ citation.source === 'question' ? '练习题' : '教材' }}
              </span>
              <span class="cite-score">{{ citation.score.toFixed(2) }}</span>
            </div>
            <div class="cite-title">{{ citationTitle(citation) }}</div>
            <div class="cite-meta">{{ citationMeta(citation) }}</div>
            <p class="cite-quote" :class="{ open: expanded.includes(citationIndex(citation)) }">
              {{ citation.quote }}
            </p>
            <button class="cite-toggle" type="button" @click.stop="toggleQuote(citationIndex(citation))">
              {{ expanded.includes(citationIndex(citation)) ? '收起原文' : '展开原文' }}
            </button>
          </article>

          <div v-if="!activeCitations.length" class="evidence-empty">
            <el-icon><ChatDotRound /></el-icon>
            <p>提问后这里会显示命中的教材片段与练习题，点击回答中的 [n] 可定位出处。</p>
          </div>
        </div>

        <div v-if="health || activeRerank || activeRequestId" class="evidence-foot">
          <div v-if="activeRerank"><span>重排</span><code>{{ activeRerank }}</code></div>
          <div v-if="activeRequestId"><span>请求</span><code>{{ activeRequestId }}</code></div>
          <div v-if="health"><span>索引</span><code>{{ health.chunks_alias_collection || '未发布' }}</code></div>
          <div v-if="health"><span>向量模型</span><code>{{ health.embedding_provider }}</code></div>
          <div v-if="health"><span>Mongo</span><code>{{ health.mongo_ok ? 'connected' : 'unavailable' }}</code></div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 24px 22px;
}

.service-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 1px solid #f5c2bd;
  background: var(--yxp-danger-weak);
  color: var(--yxp-danger);
  border-radius: 10px;
  font-size: 12px;
}

.chat-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
}

.chat-main,
.evidence {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--yxp-surface);
  border: 1px solid var(--yxp-border);
  border-radius: var(--yxp-radius);
}

.chat-top {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--yxp-border);
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--yxp-accent-weak);
  color: var(--yxp-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.chat-title strong {
  display: block;
  font-size: 14px;
}

.chat-title small {
  display: block;
  margin-top: 2px;
  color: var(--yxp-faint);
  font-size: 11px;
}

.chat-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-log {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  scroll-behavior: smooth;
}

.welcome {
  margin: auto;
  max-width: 520px;
  text-align: center;
  padding: 12px 0 24px;
}

.welcome-mark {
  width: 44px;
  height: 44px;
  margin: 0 auto 14px;
  border-radius: 13px;
  background: var(--yxp-accent);
  color: #fff;
  font-weight: 700;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.2px;
}

.welcome p {
  margin: 8px 0 18px;
  color: var(--yxp-muted);
  font-size: 12.5px;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.suggestion {
  padding: 7px 12px;
  border: 1px solid var(--yxp-border);
  background: var(--yxp-bg);
  color: var(--yxp-muted);
  border-radius: 999px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.suggestion:hover {
  border-color: var(--yxp-accent);
  color: var(--yxp-accent);
  background: var(--yxp-accent-weak);
}

.row {
  display: flex;
  gap: 10px;
  max-width: 100%;
}

.row.user {
  justify-content: flex-end;
}

.avatar {
  flex: none;
  width: 28px;
  height: 28px;
  margin-top: 2px;
  border-radius: 9px;
  background: var(--yxp-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bubble {
  max-width: 78%;
  min-width: 0;
}

.row.user .bubble {
  max-width: 72%;
  padding: 10px 14px;
  border-radius: 12px 12px 4px 12px;
  background: var(--yxp-accent-weak);
  color: var(--yxp-text);
}

.row.assistant .bubble {
  flex: 1;
}

.bubble-text {
  font-size: 13.5px;
  line-height: 1.78;
  white-space: pre-wrap;
  word-break: break-word;
}

.row.assistant .bubble-text {
  padding-top: 4px;
}

.cite-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  margin: 0 2px;
  padding: 0 5px;
  border: none;
  border-radius: 5px;
  background: var(--yxp-accent-weak);
  color: var(--yxp-accent);
  font-size: 10.5px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  vertical-align: 2px;
}

.cite-chip:hover {
  background: var(--yxp-accent);
  color: #fff;
}

.thinking {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--yxp-faint);
  font-size: 12px;
}

.thinking i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--yxp-accent);
  opacity: 0.35;
  animation: blink 1.1s infinite;
}

.thinking i:nth-child(2) {
  animation-delay: 0.18s;
}

.thinking i:nth-child(3) {
  animation-delay: 0.36s;
}

@keyframes blink {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
}

.caret {
  display: inline-block;
  width: 7px;
  height: 14px;
  margin-left: 2px;
  background: var(--yxp-accent);
  vertical-align: -2px;
  animation: blink 1s steps(2) infinite;
}

.msg-error,
.msg-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
}

.msg-error {
  color: var(--yxp-danger);
}

.msg-note {
  color: var(--yxp-faint);
}

.msg-foot {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  color: var(--yxp-faint);
  font-size: 11px;
}

.foot-grow {
  flex: 1;
}

.foot-dot {
  color: var(--yxp-border-strong);
}

.foot-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: var(--yxp-muted);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
}

.foot-link:hover {
  color: var(--yxp-accent);
}

.composer {
  flex: none;
  padding: 10px 14px 12px;
  border-top: 1px solid var(--yxp-border);
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
}

.hint {
  color: var(--yxp-faint);
  font-size: 11px;
}

.evidence-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 16px;
  border-bottom: 1px solid var(--yxp-border);
}

.evidence-title {
  font-size: 13px;
  font-weight: 700;
}

.rewritten {
  flex: none;
  padding: 10px 16px 0;
}

.rewritten span {
  font-size: 10.5px;
  color: var(--yxp-faint);
  letter-spacing: 0.4px;
}

.rewritten p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--yxp-muted);
  line-height: 1.5;
}

.stats {
  flex: none;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 12px 16px;
}

.stat {
  padding: 7px 8px;
  border-radius: 8px;
  background: var(--yxp-bg);
  text-align: center;
}

.stat span {
  display: block;
  color: var(--yxp-faint);
  font-size: 10px;
}

.stat strong {
  display: block;
  margin-top: 2px;
  font-size: 15px;
  font-weight: 700;
}

.evidence-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cite-card {
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.cite-card:hover {
  border-color: var(--yxp-border-strong);
}

.cite-card.active {
  border-color: var(--yxp-accent);
  box-shadow: 0 0 0 2px var(--yxp-accent-weak);
}

.cite-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cite-index {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  color: var(--yxp-accent);
}

.cite-source {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: var(--yxp-info-weak);
  color: var(--yxp-info);
}

.cite-source.question {
  background: var(--yxp-warning-weak);
  color: var(--yxp-warning);
}

.cite-score {
  margin-left: auto;
  font-size: 10px;
  color: var(--yxp-faint);
  font-family: 'JetBrains Mono', Consolas, monospace;
}

.cite-title {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.cite-meta {
  margin-top: 3px;
  font-size: 10.5px;
  color: var(--yxp-faint);
}

.cite-quote {
  margin: 7px 0 0;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--yxp-muted);
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cite-quote.open {
  display: block;
  -webkit-line-clamp: unset;
}

.cite-toggle {
  margin-top: 5px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--yxp-accent);
  font-size: 10.5px;
  font-family: inherit;
  cursor: pointer;
}

.evidence-empty {
  margin: auto;
  padding: 24px 12px;
  text-align: center;
  color: var(--yxp-faint);
}

.evidence-empty .el-icon {
  font-size: 22px;
  margin-bottom: 8px;
}

.evidence-empty p {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
}

.evidence-foot {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--yxp-border);
  color: var(--yxp-faint);
  font-size: 10.5px;
}

.evidence-foot div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.evidence-foot code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  color: var(--yxp-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1180px) {
  .chat-shell {
    grid-template-columns: minmax(0, 1fr);
  }
  .evidence {
    display: none;
  }
}
</style>
