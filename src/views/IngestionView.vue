<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Close, Loading, Refresh, UploadFilled } from '@element-plus/icons-vue'
import { ingestionApi } from '@/api'
import type { ApiError } from '@/api'
import { stageLabel } from '@/constants/status'
import { useAuthStore } from '@/stores/auth'
import type { IngestionJob, Stage } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import UploadDropzone from '@/components/UploadDropzone.vue'

const auth = useAuthStore()

const query = reactive({ page: 1, pageSize: 10, status: 'all', keyword: '' })
const jobs = ref<IngestionJob[]>([])
const total = ref(0)
const loading = ref(false)
const uploading = ref(false)
const uploadForm = reactive<{ subject: string; stage: Stage }>({ subject: '数学', stage: 'high' })

const drawer = ref(false)
const detail = ref<IngestionJob | null>(null)

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'running', label: '解析中' },
  { value: 'succeeded', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'pending', label: '排队中' },
  { value: 'canceled', label: '已终止' }
]

let timer: ReturnType<typeof setTimeout> | undefined
let delay = 3000

function schedulePoll() {
  if (timer) clearTimeout(timer)
  const active = jobs.value.some((j) => j.status === 'running' || j.status === 'pending')
  if (!active) {
    delay = 3000
    return
  }
  timer = setTimeout(async () => {
    await load(false)
    delay = Math.min(Math.round(delay * 1.4), 15000)
    schedulePoll()
  }, delay)
}

async function load(showLoading = true) {
  if (showLoading) loading.value = true
  try {
    const result = await ingestionApi.listJobs({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status === 'all' ? undefined : query.status,
      keyword: query.keyword || undefined
    })
    jobs.value = result.items
    total.value = result.total
    schedulePoll()
  } finally {
    if (showLoading) loading.value = false
  }
}

function applyFilter() {
  query.page = 1
  load()
}

function openDetail(row: IngestionJob) {
  detail.value = row
  drawer.value = true
  ingestionApi.getJob(row.id).then((job) => {
    detail.value = job
  })
}

function detectSourceType(name: string): IngestionJob['sourceType'] {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'PDF'
  if (ext === 'doc' || ext === 'docx') return 'DOCX'
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'IMAGE'
  return 'ZIP'
}

async function handleFile(file: File) {
  if (!auth.has('ingestion.create')) {
    ElMessage.warning('当前角色没有创建入库任务的权限')
    return
  }
  uploading.value = true
  try {
    const presign = await ingestionApi.presign(file.name)
    const response = await fetch(presign.uploadUrl, { method: 'PUT', body: file })
    if (!response.ok) throw new Error('文件上传失败')
    const job = await ingestionApi.createJob({
      filename: file.name,
      objectKey: presign.objectKey,
      sourceType: detectSourceType(file.name),
      subject: uploadForm.subject,
      stage: uploadForm.stage,
      sizeMb: Number((file.size / 1048576).toFixed(1))
    })
    ElMessage.success(`任务已创建：${job.name}`)
    query.page = 1
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建任务失败')
  } finally {
    uploading.value = false
  }
}

async function retry(row: IngestionJob) {
  try {
    const job = await ingestionApi.retry(row.id)
    detail.value = job
    ElMessage.success('已重新提交解析')
    await load(false)
  } catch (error) {
    ElMessage.error((error as ApiError).message || '重试失败')
  }
}

async function cancel(row: IngestionJob) {
  try {
    await ElMessageBox.confirm(`确认终止任务「${row.name}」？已解析的内容会保留。`, '终止任务', {
      confirmButtonText: '终止',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    const job = await ingestionApi.cancel(row.id)
    detail.value = job
    ElMessage.success('任务已终止')
    await load(false)
  } catch (error) {
    ElMessage.error((error as ApiError).message || '终止失败')
  }
}

onMounted(load)
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="page">
    <PageHeader title="内容接入" subtitle="上传 PDF / DOCX / 图片，自动完成版面识别、题目切分与结构化">
      <template #actions>
        <button class="ghost-btn" type="button" @click="load()">
          <el-icon><Refresh /></el-icon>刷新
        </button>
      </template>
    </PageHeader>

    <section class="card">
      <div class="card-head">
        <div>
          <div class="card-title">快速接入</div>
          <div class="upload-hint">单文件 ≤ 200 MB，支持批量压缩包；公式与图片会进入人工校对队列</div>
        </div>
        <span class="chip chip--info">Qwen2.5-VL · OCR</span>
      </div>
      <div v-if="auth.has('ingestion.create')" class="upload-body">
        <UploadDropzone :title="uploading ? '正在创建解析任务…' : '拖拽文件到此处，或点击选择'" @file="handleFile" />
        <div class="upload-side">
          <label class="side-field">
            <span>学科</span>
            <el-select v-model="uploadForm.subject" size="small">
              <el-option label="数学" value="数学" />
              <el-option label="物理" value="物理" />
              <el-option label="化学" value="化学" />
            </el-select>
          </label>
          <label class="side-field">
            <span>学段</span>
            <el-select v-model="uploadForm.stage" size="small">
              <el-option label="小学" value="primary" />
              <el-option label="初中" value="middle" />
              <el-option label="高中" value="high" />
            </el-select>
          </label>
          <div class="upload-tip">
            <el-icon><UploadFilled /></el-icon>
            <div>
              <strong>入库后自动进入解析</strong>
              <p>失败任务可在下方列表重试，不会重复计费。</p>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="readonly-note">当前角色仅可查看任务，如需上传请联系教研管理员或内容管理员。</div>
    </section>

    <div class="toolbar">
      <div class="toolbar-group">
        <el-input
          v-model="query.keyword"
          class="keyword"
          placeholder="搜索文件名 / 任务 ID"
          clearable
          size="small"
          @keyup.enter="applyFilter"
          @clear="applyFilter"
        />
        <el-select v-model="query.status" size="small" style="width: 120px" @change="applyFilter">
          <el-option
            v-for="option in STATUS_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-button size="small" @click="applyFilter">查询</el-button>
      </div>
      <span class="text-faint">共 {{ total }} 个任务 · 解析中任务每 3–15 秒自动刷新</span>
    </div>

    <section class="card table-card">
      <el-table v-loading="loading" :data="jobs" size="small" style="width: 100%">
        <el-table-column label="任务" min-width="250">
          <template #default="{ row }">
            <div class="job-cell">
              <span class="file-badge">{{ row.sourceType }}</span>
              <div class="job-meta">
                <span class="ellipsis">{{ row.name }}</span>
                <small class="mono">{{ row.id }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="学科 / 学段" width="110">
          <template #default="{ row }">{{ row.subject }} · {{ stageLabel(row.stage) }}</template>
        </el-table-column>
        <el-table-column label="规模" width="120">
          <template #default="{ row }">{{ row.pages || '—' }} 页 · {{ row.sizeMb }} MB</template>
        </el-table-column>
        <el-table-column label="进度" width="150">
          <template #default="{ row }">
            <div class="progress-cell">
              <el-progress
                :percentage="row.progress"
                :stroke-width="4"
                :show-text="false"
                :status="row.status === 'failed' ? 'exception' : undefined"
              />
              <span class="mono">{{ row.progress }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="96">
          <template #default="{ row }"><StatusTag kind="job" :status="row.status" /></template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="150" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 'failed'"
              v-permission="'ingestion.retry'"
              link
              type="primary"
              size="small"
              @click="retry(row)"
            >
              重试
            </el-button>
            <el-button
              v-if="row.status === 'running' || row.status === 'pending'"
              v-permission="'ingestion.cancel'"
              link
              type="danger"
              size="small"
              @click="cancel(row)"
            >
              终止
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, prev, pager, next"
          background
          small
          @current-change="load()"
        />
      </div>
    </section>

    <el-drawer v-model="drawer" size="520px" title="任务详情">
      <template v-if="detail">
        <div class="detail-head">
          <div>
            <div class="detail-title">{{ detail.name }}</div>
            <div class="mono text-faint">{{ detail.id }}</div>
          </div>
          <StatusTag kind="job" :status="detail.status" />
        </div>

        <el-progress
          :percentage="detail.progress"
          :stroke-width="6"
          :status="detail.status === 'failed' ? 'exception' : undefined"
          style="margin: 18px 0"
        />

        <dl class="meta-list">
          <div><dt>文件类型</dt><dd>{{ detail.sourceType }}</dd></div>
          <div><dt>学科 / 学段</dt><dd>{{ detail.subject }} · {{ stageLabel(detail.stage) }}</dd></div>
          <div><dt>页数 / 大小</dt><dd>{{ detail.pages || '—' }} 页 · {{ detail.sizeMb }} MB</dd></div>
          <div><dt>创建时间</dt><dd>{{ detail.createdAt }}</dd></div>
        </dl>

        <div v-if="detail.error" class="error-box">
          <strong>解析失败</strong>
          <p class="mono">{{ detail.error }}</p>
        </div>

        <div class="section-label">解析步骤</div>
        <ol class="steps">
          <li v-for="(step, index) in detail.steps" :key="step.key" :class="`is-${step.status}`">
            <span class="step-dot">
              <el-icon v-if="step.status === 'done'"><Check /></el-icon>
              <el-icon v-else-if="step.status === 'failed'"><Close /></el-icon>
              <el-icon v-else-if="step.status === 'running'" class="spin"><Loading /></el-icon>
              <span v-else class="step-index">{{ index + 1 }}</span>
            </span>
            <div class="step-main">
              <strong>{{ step.label }}</strong>
              <small v-if="step.status === 'running'">进行中…</small>
              <small v-else-if="step.status === 'pending'">等待执行</small>
              <small v-else-if="step.status === 'failed'">解析中断</small>
              <small v-else>已完成</small>
            </div>
          </li>
        </ol>

        <div class="drawer-actions">
          <el-button size="small" @click="drawer = false">关闭</el-button>
          <el-button
            v-if="detail.status === 'failed'"
            v-permission="'ingestion.retry'"
            type="primary"
            size="small"
            @click="retry(detail)"
          >
            重新解析
          </el-button>
          <el-button
            v-if="detail.status === 'running' || detail.status === 'pending'"
            v-permission="'ingestion.cancel'"
            type="danger"
            plain
            size="small"
            @click="cancel(detail)"
          >
            终止任务
          </el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.upload-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  padding: 0 18px 18px;
}
.upload-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
  background: #fbfcfd;
}
.side-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--yxp-muted);
}
.side-field > span {
  flex: none;
  white-space: nowrap;
}
.side-field :deep(.el-select) {
  width: 150px;
}
.upload-tip {
  display: flex;
  gap: 9px;
  padding-top: 12px;
  border-top: 1px dashed var(--yxp-border);
  color: var(--yxp-accent);
}
.upload-tip strong {
  display: block;
  font-size: 12px;
  color: var(--yxp-text);
}
.upload-tip p {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--yxp-faint);
}
.upload-hint {
  margin-top: 3px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.readonly-note {
  margin: 0 18px 18px;
  padding: 12px;
  border-radius: 8px;
  background: var(--yxp-bg);
  color: var(--yxp-muted);
  font-size: 12px;
}
.keyword {
  width: 240px;
}
.table-card {
  overflow: hidden;
}
.job-cell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.file-badge {
  flex: none;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--yxp-bg);
  color: var(--yxp-muted);
  font-size: 10px;
  font-family: 'JetBrains Mono', Consolas, monospace;
}
.job-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.job-meta small {
  color: var(--yxp-faint);
}
.progress-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-cell :deep(.el-progress) {
  flex: 1;
}
.progress-cell span {
  color: var(--yxp-faint);
  width: 32px;
  text-align: right;
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
}
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.detail-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}
.meta-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--yxp-border);
}
.meta-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--yxp-border);
  font-size: 12px;
}
.meta-list dt {
  color: var(--yxp-faint);
}
.meta-list dd {
  margin: 0;
  color: var(--yxp-text);
}
.error-box {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--yxp-danger-weak);
  color: var(--yxp-danger);
}
.error-box p {
  margin: 4px 0 0;
  word-break: break-all;
}
.section-label {
  margin: 20px 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--yxp-muted);
}
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  position: relative;
}
.steps li + li::before {
  content: '';
  position: absolute;
  left: 11px;
  top: -8px;
  width: 1px;
  height: 14px;
  background: var(--yxp-border);
}
.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  background: var(--yxp-bg);
  color: var(--yxp-faint);
  flex: none;
}
.steps li.is-done .step-dot {
  background: var(--yxp-success-weak);
  color: var(--yxp-success);
}
.steps li.is-running .step-dot {
  background: var(--yxp-info-weak);
  color: var(--yxp-info);
}
.steps li.is-failed .step-dot {
  background: var(--yxp-danger-weak);
  color: var(--yxp-danger);
}
.step-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.step-main strong {
  font-size: 12px;
  font-weight: 500;
  color: var(--yxp-text);
}
.step-main small {
  font-size: 10px;
  color: var(--yxp-faint);
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--yxp-border);
}
@media (max-width: 1200px) {
  .upload-body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
