<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Close, Refresh } from '@element-plus/icons-vue'
import { reviewApi } from '@/api'
import type { ReviewTask } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'

const kind = ref('')
const tasks = ref<ReviewTask[]>([])
const total = ref(0)
const loading = ref(false)
const selected = ref<ReviewTask | null>(null)
const comment = ref('')
const deciding = ref(false)
const batching = ref(false)

const KIND_OPTIONS = [
  { value: '', label: '全部' },
  { value: '题目', label: '题目' },
  { value: '知识点', label: '知识点' },
  { value: '教材', label: '教材' }
]

const pendingCount = computed(() => tasks.value.length)

async function load() {
  loading.value = true
  try {
    const result = await reviewApi.list({
      page: 1,
      pageSize: 50,
      kind: kind.value || undefined
    })
    tasks.value = result.items
    total.value = result.total
    selected.value = result.items[0] ?? null
    comment.value = ''
  } finally {
    loading.value = false
  }
}

function onKindChange(value: string) {
  kind.value = value
  load()
}

async function decide(decision: 'approve' | 'reject') {
  if (!selected.value) return
  if (decision === 'reject' && !comment.value.trim()) {
    ElMessage.warning('驳回时请填写原因，便于提交人修改')
    return
  }
  deciding.value = true
  try {
    await reviewApi.decide(selected.value.id, { decision, comment: comment.value })
    const removedId = selected.value.id
    tasks.value = tasks.value.filter((task) => task.id !== removedId)
    total.value = Math.max(0, total.value - 1)
    selected.value = tasks.value[0] ?? null
    comment.value = ''
    ElMessage.success(decision === 'approve' ? '已通过并进入下一环节' : '已驳回给提交人')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交失败')
  } finally {
    deciding.value = false
  }
}

async function batchApprove() {
  if (tasks.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确认批量通过当前列表中的 ${tasks.value.length} 条记录？通过后将直接进入发布候选。`,
      '批量审核',
      { confirmButtonText: '全部通过', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  batching.value = true
  try {
    const ids = tasks.value.map((task) => task.id)
    await Promise.all(ids.map((id) => reviewApi.decide(id, { decision: 'approve' })))
    ElMessage.success(`已批量通过 ${ids.length} 条记录`)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '批量审核失败')
    await load()
  } finally {
    batching.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <PageHeader title="审核" subtitle="审核题目、知识点与教材变更，审核结果决定能否进入发布候选">
      <template #actions>
        <button class="ghost-btn" type="button" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </button>
        <button
          v-permission="'review.batch'"
          class="primary-btn"
          type="button"
          :disabled="batching || pendingCount === 0"
          @click="batchApprove"
        >
          批量通过（{{ pendingCount }}）
        </button>
      </template>
    </PageHeader>

    <div class="toolbar">
      <div class="toolbar-group">
        <button
          v-for="option in KIND_OPTIONS"
          :key="option.value"
          type="button"
          class="kind-tab"
          :class="{ 'is-active': kind === option.value }"
          @click="onKindChange(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <span class="text-faint">待审核 {{ total }} 条 · 点击左侧切换审核对象</span>
    </div>

    <div v-loading="loading" class="split review-split">
      <aside class="card queue-card">
        <div class="card-head">
          <div class="card-title">待审队列</div>
          <span class="chip chip--warning">{{ tasks.length }} 条</span>
        </div>
        <div class="queue-scroll">
          <button
            v-for="task in tasks"
            :key="task.id"
            type="button"
            class="queue-item"
            :class="{ 'is-active': selected?.id === task.id }"
            @click="selected = task; comment = ''"
          >
            <div class="queue-top">
              <span class="chip chip--accent">{{ task.kind }}</span>
              <StatusTag kind="review" :status="task.priority" />
            </div>
            <div class="queue-title">{{ task.title }}</div>
            <div class="queue-meta">
              <span>{{ task.submitter }}</span>
              <span>{{ task.submittedAt }}</span>
            </div>
          </button>
          <div v-if="tasks.length === 0" class="empty">暂无待审任务</div>
        </div>
      </aside>

      <section class="card review-detail">
        <template v-if="selected">
          <div class="detail-head">
            <div>
              <div class="detail-meta">
                <span class="chip chip--accent">{{ selected.kind }}</span>
                <StatusTag kind="review" :status="selected.priority" />
                <span class="text-faint">{{ selected.submitter }} 提交 · {{ selected.submittedAt }}</span>
              </div>
              <h2 class="detail-title">{{ selected.title }}</h2>
            </div>
            <span class="mono text-faint">{{ selected.id }}</span>
          </div>

          <div class="detail-body">
            <template v-if="selected.payload.stem">
              <div class="section-label">题干</div>
              <p class="payload-text">{{ selected.payload.stem }}</p>
            </template>

            <template v-if="selected.payload.formula">
              <div class="section-label">公式</div>
              <pre class="formula-box">{{ selected.payload.formula }}</pre>
            </template>

            <div v-if="selected.payload.answer" class="answer-box">
              <span>参考答案</span>
              <strong>{{ selected.payload.answer }}</strong>
            </div>

            <template v-if="selected.payload.analysis">
              <div class="section-label">解析</div>
              <p class="payload-text">{{ selected.payload.analysis }}</p>
            </template>

            <template v-if="selected.payload.changeNote">
              <div class="section-label">变更说明</div>
              <p class="payload-text">{{ selected.payload.changeNote }}</p>
            </template>

            <div v-if="selected.payload.knowledgePoints?.length" class="section-row">
              <div class="section-label" style="margin: 0">知识点</div>
              <div class="chip-row">
                <span v-for="kp in selected.payload.knowledgePoints" :key="kp" class="chip chip--accent">
                  {{ kp }}
                </span>
              </div>
            </div>

            <div v-if="selected.payload.confidence" class="confidence-row">
              <span class="confidence-label">模型置信度</span>
              <el-progress
                :percentage="selected.payload.confidence"
                :stroke-width="6"
                :show-text="false"
                style="width: 220px"
              />
              <span class="mono">{{ selected.payload.confidence }}%</span>
            </div>

            <div v-if="selected.payload.source" class="source-row">
              <span class="text-faint">来源</span>
              <span>{{ selected.payload.source }}</span>
            </div>
          </div>

          <div class="decision-box">
            <div class="section-label" style="margin-top: 0">审核意见</div>
            <el-input
              v-model="comment"
              type="textarea"
              :rows="3"
              resize="none"
              placeholder="通过可留空；驳回请说明需要修改的内容"
            />
            <div class="decision-actions">
              <el-button
                v-permission="'review.decide'"
                type="primary"
                size="small"
                :loading="deciding"
                @click="decide('approve')"
              >
                <el-icon style="margin-right: 4px"><Check /></el-icon>通过
              </el-button>
              <el-button
                v-permission="'review.decide'"
                type="danger"
                plain
                size="small"
                :disabled="deciding"
                @click="decide('reject')"
              >
                <el-icon style="margin-right: 4px"><Close /></el-icon>驳回
              </el-button>
              <span class="text-faint decision-hint">审核结果会写入审计日志，可在系统设置中查询。</span>
            </div>
          </div>
        </template>
        <div v-else class="empty">待审队列已清空</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.kind-tab {
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--yxp-border);
  background: var(--yxp-surface);
  color: var(--yxp-muted);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.kind-tab:hover {
  border-color: var(--yxp-accent);
  color: var(--yxp-accent);
}
.kind-tab.is-active {
  background: var(--yxp-accent);
  border-color: var(--yxp-accent);
  color: #fff;
  font-weight: 600;
}
.review-split {
  flex: 1;
  min-height: 520px;
}
.queue-card {
  width: 360px;
  flex: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.queue-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.queue-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 11px 12px;
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
  background: var(--yxp-surface);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}
.queue-item:hover {
  border-color: var(--yxp-border-strong);
  background: #fbfcfd;
}
.queue-item.is-active {
  border-color: var(--yxp-accent);
  box-shadow: 0 0 0 2px var(--yxp-accent-weak);
}
.queue-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.queue-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.55;
  color: var(--yxp-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.queue-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--yxp-faint);
}
.review-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--yxp-border);
}
.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-title {
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
}
.detail-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 20px 18px;
}
.section-label {
  margin: 16px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--yxp-muted);
}
.section-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
.payload-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--yxp-text);
  white-space: pre-wrap;
}
.formula-box {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f7f9fb;
  border: 1px solid var(--yxp-border);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--yxp-accent);
  overflow-x: auto;
}
.answer-box {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--yxp-accent-weak);
  color: var(--yxp-accent);
  font-size: 12px;
}
.answer-box strong {
  font-size: 14px;
}
.chip-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.confidence-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.confidence-label {
  width: 70px;
}
.source-row {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  font-size: 12px;
  color: var(--yxp-muted);
}
.decision-box {
  flex: none;
  padding: 14px 20px 16px;
  border-top: 1px solid var(--yxp-border);
  background: #fbfcfd;
}
.decision-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.decision-hint {
  font-size: 10px;
  margin-left: auto;
}
@media (max-width: 1300px) {
  .queue-card {
    width: 320px;
  }
}
</style>
