<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { DataAnalysis, Refresh } from '@element-plus/icons-vue'
import { evaluationApi } from '@/api'
import type { EvalDataset } from '@/api'
import type { EvalReport, EvalRun } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'

const runs = ref<EvalRun[]>([])
const total = ref(0)
const datasets = ref<EvalDataset[]>([])
const loading = ref(false)
const selectedRunId = ref('')
const report = ref<EvalReport | null>(null)
const reportLoading = ref(false)

const runDialog = ref(false)
const running = ref(false)
const runForm = reactive({ dataset: 'eval_v1' })

const METRIC_NOTES: Record<string, string> = {
  'Recall@10': '阈值 ≥ 0.85',
  MRR: '排序质量',
  答案准确率: '对照人工标注',
  引用命中率: '引用可溯源'
}

async function load() {
  loading.value = true
  try {
    const [runResult, datasetList] = await Promise.all([
      evaluationApi.runs({ page: 1, pageSize: 20 }),
      evaluationApi.datasets()
    ])
    runs.value = runResult.items
    total.value = runResult.total
    datasets.value = datasetList
    if (!selectedRunId.value && runResult.items[0]) {
      selectedRunId.value = runResult.items[0].id
    }
    if (selectedRunId.value) await loadReport(selectedRunId.value)
  } finally {
    loading.value = false
  }
}

async function loadReport(id: string) {
  selectedRunId.value = id
  reportLoading.value = true
  try {
    report.value = await evaluationApi.report(id)
  } finally {
    reportLoading.value = false
  }
}

function rowClass({ row }: { row: EvalRun }) {
  return row.id === selectedRunId.value ? 'is-selected-row' : ''
}

async function submitRun() {
  if (!runForm.dataset) {
    ElMessage.warning('请选择评测数据集')
    return
  }
  running.value = true
  try {
    const run = await evaluationApi.run({ dataset: `${runForm.dataset} · 594 题` })
    runDialog.value = false
    ElMessage.success(`评测完成：Recall@10 ${run.recall}，准确率 ${run.accuracy}`)
    selectedRunId.value = run.id
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '评测失败')
  } finally {
    running.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <PageHeader title="评测" subtitle="以固定题集验证检索召回与生成质量，评测通过后才能提交发布">
      <template #actions>
        <button class="ghost-btn" type="button" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </button>
        <button v-permission="'evaluation.run'" class="primary-btn" type="button" @click="runDialog = true">
          <el-icon><DataAnalysis /></el-icon>运行评测
        </button>
      </template>
    </PageHeader>

    <div v-loading="reportLoading" class="metric-grid">
      <div v-for="metric in report?.metrics ?? []" :key="metric.label" class="metric-card">
        <div class="metric-label">
          <span>{{ metric.label }}</span>
          <span class="chip" :class="metric.value >= 0.85 ? 'chip--success' : 'chip--warning'">
            {{ metric.value >= 0.85 ? '达标' : '关注' }}
          </span>
        </div>
        <div class="metric-value">{{ metric.display }}</div>
        <div class="metric-note">{{ METRIC_NOTES[metric.label] || '评测指标' }}</div>
      </div>
      <div v-if="!report" class="metric-card">
        <div class="metric-label">暂无评测数据</div>
        <div class="metric-value">—</div>
        <div class="metric-note">运行一次评测以生成报告</div>
      </div>
    </div>

    <div class="eval-grid">
      <section class="card">
        <div class="card-head">
          <div>
            <div class="card-title">评测记录</div>
            <div class="eval-sub">共 {{ total }} 次 · 点击行查看报告</div>
          </div>
          <span class="chip chip--info">{{ report?.runId || '—' }}</span>
        </div>
        <el-table
          v-loading="loading"
          :data="runs"
          size="small"
          style="width: 100%"
          :row-class-name="rowClass"
          @row-click="(row: EvalRun) => loadReport(row.id)"
        >
          <el-table-column label="评测批次" min-width="170">
            <template #default="{ row }">
              <div class="run-id mono">{{ row.id }}</div>
              <div class="text-faint run-dataset">{{ row.dataset }}</div>
            </template>
          </el-table-column>
          <el-table-column label="Recall@10" width="100">
            <template #default="{ row }">
              <span class="mono metric-num" :class="{ 'is-low': row.recall < 0.85 }">{{ row.recall.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="准确率" width="90">
            <template #default="{ row }">
              <span class="mono metric-num" :class="{ 'is-low': row.accuracy < 0.8 }">{{ row.accuracy.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="86">
            <template #default="{ row }"><StatusTag kind="eval" :status="row.status" /></template>
          </el-table-column>
          <el-table-column prop="createdAt" label="时间" width="140" />
        </el-table>
      </section>

      <section v-loading="reportLoading" class="card failure-card">
        <div class="card-head">
          <div>
            <div class="card-title">失败样例</div>
            <div class="eval-sub">按错误类型归类，指导内容补齐</div>
          </div>
          <span class="chip chip--danger">{{ report?.failures.length ?? 0 }} 条</span>
        </div>
        <div class="failure-list">
          <div v-for="(failure, index) in report?.failures ?? []" :key="index" class="failure-item">
            <span class="failure-index mono">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="failure-main">
              <strong>{{ failure.question }}</strong>
              <span class="chip" :class="`chip--${failure.tone}`">{{ failure.reason }}</span>
            </div>
          </div>
          <div v-if="!report" class="empty">暂无报告</div>
        </div>
        <div class="report-foot">
          <span class="text-faint">报告生成于 {{ report?.createdAt || '—' }}</span>
          <span class="text-faint">模型 · qwen2.5-72b</span>
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head">
        <div>
          <div class="card-title">评测数据集</div>
          <div class="eval-sub">固定题集，用于横向比较不同版本</div>
        </div>
        <span class="text-faint">{{ datasets.length }} 个数据集</span>
      </div>
      <div class="dataset-row">
        <div v-for="dataset in datasets" :key="dataset.id" class="dataset-item">
          <div>
            <strong>{{ dataset.name }}</strong>
            <small>{{ dataset.questionCount }} 题 · 更新于 {{ dataset.updatedAt }}</small>
          </div>
          <span class="chip chip--accent mono">{{ dataset.id }}</span>
        </div>
      </div>
    </section>

    <el-dialog v-model="runDialog" title="运行评测" width="460px">
      <div class="dialog-body">
        <label class="dialog-field">
          <span>数据集</span>
          <el-select v-model="runForm.dataset" size="small" style="width: 100%">
            <el-option
              v-for="dataset in datasets"
              :key="dataset.id"
              :label="`${dataset.name} · ${dataset.questionCount} 题`"
              :value="dataset.name"
            />
          </el-select>
        </label>
        <div class="dialog-tip">
          <span class="dot dot--info" />
          评测将对固定题集执行召回与生成，预计耗时 2–5 分钟；结果不影响线上服务。
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="runDialog = false">取消</el-button>
        <el-button type="primary" size="small" :loading="running" @click="submitRun">开始评测</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.eval-sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.eval-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 16px;
}
.run-id {
  font-size: 11px;
  color: var(--yxp-text);
  font-weight: 600;
}
.run-dataset {
  font-size: 10px;
  margin-top: 1px;
}
.metric-num {
  font-size: 12px;
  font-weight: 600;
  color: var(--yxp-success);
}
.metric-num.is-low {
  color: var(--yxp-danger);
}
.failure-card {
  display: flex;
  flex-direction: column;
}
.failure-list {
  flex: 1;
  padding: 0 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.failure-item {
  display: flex;
  gap: 10px;
  padding: 10px 11px;
  border: 1px solid var(--yxp-border);
  border-radius: 9px;
}
.failure-index {
  color: var(--yxp-faint);
  font-size: 10px;
  margin-top: 2px;
}
.failure-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}
.failure-main strong {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}
.report-foot {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  margin-top: 8px;
  border-top: 1px solid var(--yxp-border);
  font-size: 10px;
}
.dataset-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  padding: 0 16px 16px;
}
.dataset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 13px;
  border: 1px solid var(--yxp-border);
  border-radius: 9px;
  background: #fbfcfd;
}
.dataset-item strong {
  display: block;
  font-size: 12px;
  font-weight: 600;
}
.dataset-item small {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--yxp-faint);
}
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dialog-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--yxp-muted);
}
.dialog-tip {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--yxp-bg);
  color: var(--yxp-muted);
  font-size: 11px;
  line-height: 1.6;
}
.eval-grid :deep(.el-table__row) {
  cursor: pointer;
}
.eval-grid :deep(.is-selected-row) {
  background: var(--yxp-accent-weak) !important;
}
@media (max-width: 1200px) {
  .eval-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
