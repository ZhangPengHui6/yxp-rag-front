<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Checked, DataAnalysis, EditPen, Plus, Refresh, WarningFilled } from '@element-plus/icons-vue'
import { dashboardApi, ingestionApi } from '@/api'
import type { DashboardSummary, IngestionJob } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import MetricCard from '@/components/MetricCard.vue'
import TrendChart from '@/components/TrendChart.vue'
import StatusTag from '@/components/StatusTag.vue'

const router = useRouter()
const summary = ref<DashboardSummary | null>(null)
const jobs = ref<IngestionJob[]>([])
const loading = ref(true)

const dateText = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})

const todoIcons: Record<string, typeof EditPen> = {
  annotation: EditPen,
  review: Checked,
  failed_job: WarningFilled,
  coverage: DataAnalysis
}

const todoRoutes: Record<string, string> = {
  annotation: '/annotation',
  review: '/review',
  failed_job: '/ingestion',
  coverage: '/knowledge'
}

const metrics = computed(() => summary.value?.metrics ?? [])
const todos = computed(() => summary.value?.todos ?? [])
const trend = computed(() => summary.value?.trend ?? [])

async function load() {
  loading.value = true
  try {
    const [summaryData, jobData] = await Promise.all([
      dashboardApi.summary(),
      ingestionApi.listJobs({ page: 1, pageSize: 5 })
    ])
    summary.value = summaryData
    jobs.value = jobData.items
  } finally {
    loading.value = false
  }
}

function goto(path: string) {
  router.push(path)
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page">
    <PageHeader title="工作台" :subtitle="`${dateText} · 知识库运行概览`">
      <template #actions>
        <button class="ghost-btn" type="button" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </button>
        <button v-permission="'ingestion.create'" class="primary-btn" type="button" @click="goto('/ingestion')">
          <el-icon><Plus /></el-icon>新建入库
        </button>
      </template>
    </PageHeader>

    <div class="metric-grid">
      <MetricCard
        v-for="metric in metrics"
        :key="metric.key"
        :label="metric.label"
        :value="metric.value"
        :note="metric.note"
        :tone="metric.tone"
      />
    </div>

    <div class="dash-grid">
      <section class="card trend-card">
        <div class="card-head">
          <div>
            <div class="card-title">近 7 日知识生产</div>
            <div class="card-hint">入库条目与发布条目的每日变化</div>
          </div>
          <span class="chip chip--accent">每日更新</span>
        </div>
        <div class="trend-body">
          <TrendChart :data="trend" />
        </div>
      </section>

      <section class="card todo-card">
        <div class="card-head">
          <div class="card-title">我的待办</div>
          <span class="text-faint">共 {{ todos.reduce((sum, t) => sum + t.count, 0) }} 项</span>
        </div>
        <div class="todo-list">
          <button
            v-for="todo in todos"
            :key="todo.id"
            class="todo-item"
            type="button"
            @click="goto(todoRoutes[todo.kind] || '/dashboard')"
          >
            <span class="todo-icon" :class="`todo-icon--${todo.tone}`">
              <el-icon><component :is="todoIcons[todo.kind]" /></el-icon>
            </span>
            <span class="todo-main">
              <strong>{{ todo.title }}</strong>
              <small>{{ todo.count }} 条待处理</small>
            </span>
            <span class="todo-count">{{ todo.count }}</span>
            <el-icon class="todo-arrow"><ArrowRight /></el-icon>
          </button>
        </div>
        <div class="todo-note">
          <span class="dot dot--warning" />
          建议优先处理低置信度内容，避免影响索引质量
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head">
        <div class="card-title">最近入库任务</div>
        <button class="link-btn" type="button" @click="goto('/ingestion')">
          全部任务<el-icon><ArrowRight /></el-icon>
        </button>
      </div>
      <el-table :data="jobs" size="small" style="width: 100%" @row-click="goto('/ingestion')">
        <el-table-column prop="name" label="任务" min-width="240">
          <template #default="{ row }">
            <div class="job-name">
              <span class="file-badge">{{ row.sourceType }}</span>
              <span class="ellipsis">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="subject" label="科目" width="80" />
        <el-table-column label="页数" width="80">
          <template #default="{ row }">{{ row.pages || '—' }}</template>
        </el-table-column>
        <el-table-column label="进度" width="140">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="4" :show-text="false" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="96">
          <template #default="{ row }"><StatusTag kind="job" :status="row.status" /></template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="150" />
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.dash-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 16px;
}
.trend-body {
  padding: 0 14px 12px;
}
.card-hint {
  margin-top: 3px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px 10px;
}
.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
  background: var(--yxp-surface);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: all 0.15s ease;
}
.todo-item:hover {
  border-color: var(--yxp-accent);
  background: #fbfdfc;
}
.todo-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex: none;
}
.todo-icon--warning {
  background: var(--yxp-warning-weak);
  color: var(--yxp-warning);
}
.todo-icon--danger {
  background: var(--yxp-danger-weak);
  color: var(--yxp-danger);
}
.todo-icon--info {
  background: var(--yxp-info-weak);
  color: var(--yxp-info);
}
.todo-icon--success {
  background: var(--yxp-success-weak);
  color: var(--yxp-success);
}
.todo-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.todo-main strong {
  font-size: 12px;
  font-weight: 600;
}
.todo-main small {
  font-size: 11px;
  color: var(--yxp-faint);
}
.todo-count {
  font-size: 16px;
  font-weight: 700;
  color: var(--yxp-text);
}
.todo-arrow {
  color: var(--yxp-faint);
  font-size: 12px;
}
.todo-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 14px 14px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--yxp-bg);
  color: var(--yxp-muted);
  font-size: 11px;
}
.job-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.file-badge {
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--yxp-bg);
  color: var(--yxp-muted);
  font-size: 10px;
  font-family: 'JetBrains Mono', Consolas, monospace;
}
.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--yxp-accent);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
@media (max-width: 1200px) {
  .dash-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
