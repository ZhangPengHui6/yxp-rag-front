<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Flag, Refresh } from '@element-plus/icons-vue'
import { annotationApi } from '@/api'
import type { AnnotationTaskRow } from '@/api'
import { statusMeta } from '@/constants/status'
import type { AnnotationBlock, AnnotationTask } from '@/types'
import PageHeader from '@/components/PageHeader.vue'

const tasks = ref<AnnotationTaskRow[]>([])
const currentTaskId = ref('')
const task = ref<AnnotationTask | null>(null)
const selectedBlockId = ref('')
const editedContent = ref('')
const loading = ref(false)
const resolving = ref(false)

const selectedBlock = computed(
  () => task.value?.blocks.find((b) => b.id === selectedBlockId.value) ?? null
)

const resolvedCount = computed(
  () => task.value?.blocks.filter((b) => b.status !== 'pending').length ?? 0
)

const progress = computed(() => {
  if (!task.value || task.value.blocks.length === 0) return 0
  return Math.round((resolvedCount.value / task.value.blocks.length) * 100)
})

function confidenceClass(value: number) {
  if (value >= 95) return 'conf--high'
  if (value >= 80) return 'conf--mid'
  return 'conf--low'
}

function selectBlock(block: AnnotationBlock) {
  selectedBlockId.value = block.id
  editedContent.value = block.content
}

function selectNextPending() {
  const next = task.value?.blocks.find((b) => b.status === 'pending')
  if (next) selectBlock(next)
}

async function loadTasks() {
  const result = await annotationApi.list({ page: 1, pageSize: 20 })
  tasks.value = result.items
}

async function loadTask(id: string) {
  loading.value = true
  try {
    const data = await annotationApi.detail(id)
    task.value = data
    const pending = data.blocks.find((b) => b.status === 'pending') ?? data.blocks[0]
    if (pending) selectBlock(pending)
  } finally {
    loading.value = false
  }
}

async function resolveBlock(action: 'resolve' | 'flag') {
  const block = selectedBlock.value
  if (!task.value || !block) return
  if (action === 'resolve' && !editedContent.value.trim()) {
    ElMessage.warning('内容不能为空')
    return
  }
  resolving.value = true
  try {
    await annotationApi.resolve(task.value.id, {
      blockId: block.id,
      action,
      content: editedContent.value
    })
    block.status = action === 'flag' ? 'flagged' : 'resolved'
    block.content = editedContent.value
    ElMessage.success(action === 'flag' ? '已标记，等待教研确认' : '已确认该段内容')
    const next = task.value.blocks.find((b) => b.status === 'pending')
    if (next) selectBlock(next)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交失败')
  } finally {
    resolving.value = false
  }
}

function onTaskChange(id: string) {
  loadTask(id)
}

onMounted(async () => {
  await loadTasks()
  if (tasks.value.length > 0) {
    currentTaskId.value = tasks.value[0].id
    await loadTask(currentTaskId.value)
  }
})
</script>

<template>
  <div class="page">
    <PageHeader title="校对" subtitle="处理低置信度的识别结果，确认后的内容将进入审核队列">
      <template #actions>
        <button class="ghost-btn" type="button" @click="loadTask(currentTaskId)">
          <el-icon><Refresh /></el-icon>刷新
        </button>
      </template>
    </PageHeader>

    <div class="task-bar card">
      <div class="task-bar-left">
        <span class="task-label">校对任务</span>
        <el-select
          v-model="currentTaskId"
          size="small"
          style="width: 320px"
          @change="onTaskChange"
        >
          <el-option
            v-for="item in tasks"
            :key="item.id"
            :label="`${item.book} · ${item.chapter} (P${item.page})`"
            :value="item.id"
          />
        </el-select>
        <span v-if="task" class="text-faint">{{ task.chapter }} · 第 {{ task.page }} / {{ task.pageTotal }} 页</span>
      </div>
      <div class="task-bar-right">
        <div class="progress-wrap">
          <el-progress :percentage="progress" :stroke-width="6" :show-text="false" />
          <span class="mono">{{ resolvedCount }} / {{ task?.blocks.length ?? 0 }}</span>
        </div>
        <span class="text-faint">当前页待处理 {{ task?.blocks.filter((b) => b.status === 'pending').length ?? 0 }} 段</span>
      </div>
    </div>

    <div v-loading="loading" class="split annotation-split">
      <section class="card blocks-card">
        <div class="card-head">
          <div>
            <div class="card-title">识别结果</div>
            <div class="blocks-sub">点击任意段落进入校对，置信度低于 80% 的内容会高亮提示</div>
          </div>
          <span class="chip chip--warning">置信度 &lt; 80% 需人工确认</span>
        </div>
        <div class="block-scroll">
          <button
            v-for="block in task?.blocks ?? []"
            :key="block.id"
            type="button"
            class="block"
            :class="{ 'is-active': block.id === selectedBlockId, 'is-resolved': block.status === 'resolved' }"
            @click="selectBlock(block)"
          >
            <span class="block-index">{{ block.index }}</span>
            <span class="block-main">
              <span class="block-meta">
                <span class="chip">{{ block.type }}</span>
                <span class="conf mono" :class="confidenceClass(block.confidence)">
                  {{ block.confidence }}%
                </span>
                <span v-if="block.status === 'resolved'" class="chip chip--success">已确认</span>
                <span v-else-if="block.status === 'flagged'" class="chip chip--danger">已标记</span>
                <span v-else class="chip chip--warning">待处理</span>
              </span>
              <span class="block-text">{{ block.content }}</span>
            </span>
          </button>
        </div>
      </section>

      <aside class="card editor-card">
        <template v-if="selectedBlock">
          <div class="editor-head">
            <div>
              <div class="card-title">校对面板</div>
              <div class="text-faint">第 {{ selectedBlock.index }} 段 · {{ selectedBlock.type }}</div>
            </div>
            <span class="conf mono" :class="confidenceClass(selectedBlock.confidence)">
              置信度 {{ selectedBlock.confidence }}%
            </span>
          </div>

          <div class="editor-body">
            <label class="editor-label">
              <span>识别内容（可修正）</span>
              <el-input
                v-model="editedContent"
                type="textarea"
                :rows="9"
                resize="none"
                placeholder="请输入修正后的内容"
              />
            </label>

            <div class="editor-tip">
              <span class="dot dot--info" />
              公式请使用 LaTeX 语法，例如 <code>f(x)=ax^2+bx+c</code>
            </div>

            <div class="editor-actions">
              <el-button
                v-permission="'annotation.resolve'"
                type="primary"
                size="small"
                :loading="resolving"
                @click="resolveBlock('resolve')"
              >
                <el-icon style="margin-right: 4px"><Check /></el-icon>确认并继续
              </el-button>
              <el-button
                v-permission="'annotation.resolve'"
                type="danger"
                plain
                size="small"
                :disabled="resolving"
                @click="resolveBlock('flag')"
              >
                <el-icon style="margin-right: 4px"><Flag /></el-icon>标记问题
              </el-button>
            </div>
            <div v-if="!selectedBlock || selectedBlock.status !== 'pending'" class="editor-done">
              本段已处理，点击上方「确认并继续」会自动跳转到下一段。
            </div>
          </div>

          <div class="editor-foot">
            <div class="foot-row">
              <span>任务进度</span>
              <strong>{{ resolvedCount }} / {{ task?.blocks.length }}</strong>
            </div>
            <div class="foot-row">
              <span>任务编号</span>
              <span class="mono">{{ task?.id }}</span>
            </div>
            <div class="foot-row">
              <span>当前状态</span>
              <span class="chip" :class="`chip--${statusMeta('annotation', selectedBlock.status).tone}`">
                {{ statusMeta('annotation', selectedBlock.status).label }}
              </span>
            </div>
          </div>
        </template>
        <div v-else class="empty">请选择左侧段落</div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.task-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  flex-wrap: wrap;
}
.task-bar-left,
.task-bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.task-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--yxp-muted);
}
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 200px;
}
.progress-wrap :deep(.el-progress) {
  flex: 1;
}
.progress-wrap span {
  color: var(--yxp-faint);
}
.annotation-split {
  flex: 1;
  min-height: 520px;
}
.blocks-card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.blocks-sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.block-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.block {
  display: flex;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
  background: var(--yxp-surface);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}
.block:hover {
  border-color: var(--yxp-border-strong);
  background: #fbfcfd;
}
.block.is-active {
  border-color: var(--yxp-accent);
  box-shadow: 0 0 0 2px var(--yxp-accent-weak);
}
.block.is-resolved {
  background: #fbfdfc;
}
.block-index {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--yxp-bg);
  color: var(--yxp-faint);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', Consolas, monospace;
}
.block-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.block-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.block-text {
  font-size: 12px;
  line-height: 1.75;
  color: var(--yxp-text);
  white-space: pre-wrap;
}
.conf {
  font-size: 11px;
  font-weight: 600;
}
.conf--high {
  color: var(--yxp-success);
}
.conf--mid {
  color: var(--yxp-warning);
}
.conf--low {
  color: var(--yxp-danger);
}
.editor-card {
  width: 380px;
  flex: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--yxp-border);
}
.editor-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.editor-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--yxp-muted);
}
.editor-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.editor-tip code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  background: var(--yxp-bg);
  padding: 1px 4px;
  border-radius: 4px;
}
.editor-actions {
  display: flex;
  gap: 8px;
}
.editor-done {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--yxp-bg);
  color: var(--yxp-muted);
  font-size: 11px;
  line-height: 1.6;
}
.editor-foot {
  padding: 12px 16px;
  border-top: 1px solid var(--yxp-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fbfcfd;
}
.foot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--yxp-faint);
}
.foot-row strong {
  color: var(--yxp-text);
}
@media (max-width: 1300px) {
  .editor-card {
    width: 340px;
  }
}
</style>
