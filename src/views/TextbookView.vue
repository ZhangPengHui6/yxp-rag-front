<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { textbookApi } from '@/api'
import type { ApiError } from '@/api'
import { stageLabel } from '@/constants/status'
import type { Textbook } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'

const router = useRouter()

const query = reactive({ page: 1, pageSize: 10, status: 'all', subject: 'all', keyword: '' })
const books = ref<Textbook[]>([])
const total = ref(0)
const loading = ref(false)

const drawer = ref(false)
const detail = ref<Textbook | null>(null)
const editingLicense = ref(false)
const saving = ref(false)
const licenseForm = reactive({ holder: '', scope: '', expiresAt: '' })

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'published', label: '已发布' },
  { value: 'reviewing', label: '审核中' },
  { value: 'draft', label: '草稿' },
  { value: 'offline', label: '已下架' }
]

const chapterCount = computed(() => (detail.value ? detail.value.chapters.length : 0))

async function load() {
  loading.value = true
  try {
    const result = await textbookApi.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status === 'all' ? undefined : query.status,
      subject: query.subject === 'all' ? undefined : query.subject,
      keyword: query.keyword || undefined
    })
    books.value = result.items
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  query.page = 1
  load()
}

async function openDetail(row: Textbook) {
  detail.value = row
  editingLicense.value = false
  drawer.value = true
  try {
    detail.value = await textbookApi.detail(row.id)
  } catch {
    /* 回退到列表数据 */
  }
}

function startEditLicense() {
  if (!detail.value) return
  licenseForm.holder = detail.value.license.holder
  licenseForm.scope = detail.value.license.scope
  licenseForm.expiresAt = detail.value.license.expiresAt
  editingLicense.value = true
}

async function saveLicense() {
  if (!detail.value) return
  saving.value = true
  try {
    const license = await textbookApi.updateLicense(detail.value.id, { ...licenseForm })
    detail.value.license = license
    const row = books.value.find((b) => b.id === detail.value?.id)
    if (row) row.license = license
    editingLicense.value = false
    ElMessage.success('授权信息已更新')
  } catch (error) {
    ElMessage.error((error as ApiError).message || '保存失败')
  } finally {
    saving.value = false
  }
}

function goIngestion() {
  ElMessage.info('教材通过「内容接入」上传后自动生成，请在新任务中选择学段与学科')
  router.push('/ingestion')
}

onMounted(load)
</script>

<template>
  <div class="page">
    <PageHeader title="教材" subtitle="管理教材元数据、章节结构与授权期限，教材内容由入库任务自动生成">
      <template #actions>
        <button class="ghost-btn" type="button" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </button>
        <button v-permission="'textbook.create'" class="primary-btn" type="button" @click="goIngestion">
          <el-icon><Plus /></el-icon>录入教材
        </button>
      </template>
    </PageHeader>

    <div class="toolbar">
      <div class="toolbar-group">
        <el-input
          v-model="query.keyword"
          class="keyword"
          placeholder="搜索教材名称"
          clearable
          size="small"
          @keyup.enter="applyFilter"
          @clear="applyFilter"
        />
        <el-select v-model="query.subject" size="small" style="width: 110px" @change="applyFilter">
          <el-option label="全部学科" value="all" />
          <el-option label="数学" value="数学" />
          <el-option label="物理" value="物理" />
          <el-option label="化学" value="化学" />
        </el-select>
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
      <span class="text-faint">共 {{ total }} 本教材</span>
    </div>

    <section class="card table-card">
      <el-table v-loading="loading" :data="books" size="small" style="width: 100%">
        <el-table-column label="教材" min-width="260">
          <template #default="{ row }">
            <div class="book-cell">
              <span class="book-cover" :class="`cover--${row.subject === '数学' ? 'math' : row.subject === '物理' ? 'physics' : 'chem'}`">
                {{ row.title.slice(0, 1) }}
              </span>
              <div class="book-meta">
                <span class="ellipsis">{{ row.title }}</span>
                <small>{{ row.edition }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="学科 / 学段" width="110">
          <template #default="{ row }">{{ row.subject }} · {{ stageLabel(row.stage) }}</template>
        </el-table-column>
        <el-table-column label="章节 / 页数" width="110">
          <template #default="{ row }">{{ row.chapters.length }} 章 · {{ row.pageCount }} 页</template>
        </el-table-column>
        <el-table-column label="授权" width="180">
          <template #default="{ row }">
            <div class="license-cell">
              <StatusTag kind="license" :status="row.license.status" />
              <small class="text-faint">{{ row.license.expiresAt }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="96">
          <template #default="{ row }"><StatusTag kind="textbook" :status="row.status" /></template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="120" />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
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
          @current-change="load"
        />
      </div>
    </section>

    <el-drawer v-model="drawer" size="600px" title="教材详情">
      <template v-if="detail">
        <div class="detail-head">
          <span class="book-cover book-cover--lg">
            {{ detail.title.slice(0, 1) }}
          </span>
          <div class="detail-title-wrap">
            <div class="detail-title">{{ detail.title }}</div>
            <div class="text-faint">{{ detail.edition }}</div>
            <div class="detail-chips">
              <StatusTag kind="textbook" :status="detail.status" />
              <span class="chip">{{ detail.subject }} · {{ stageLabel(detail.stage) }}</span>
              <span class="chip">{{ detail.pageCount }} 页</span>
            </div>
          </div>
        </div>

        <div class="license-card">
          <div class="license-head">
            <div>
              <div class="section-label" style="margin: 0">授权信息</div>
              <p class="license-note">用于核对教材使用范围，到期前 30 天会提示续签。</p>
            </div>
            <el-button
              v-if="!editingLicense"
              v-permission="'textbook.license'"
              size="small"
              @click="startEditLicense"
            >
              编辑
            </el-button>
          </div>

          <div v-if="!editingLicense" class="license-grid">
            <div><span>授权方</span><strong>{{ detail.license.holder }}</strong></div>
            <div><span>使用范围</span><strong>{{ detail.license.scope }}</strong></div>
            <div><span>到期日</span><strong>{{ detail.license.expiresAt }}</strong></div>
            <div><span>状态</span><StatusTag kind="license" :status="detail.license.status" /></div>
          </div>

          <div v-else class="license-form">
            <label><span>授权方</span><el-input v-model="licenseForm.holder" size="small" /></label>
            <label><span>使用范围</span><el-input v-model="licenseForm.scope" size="small" /></label>
            <label><span>到期日</span><el-input v-model="licenseForm.expiresAt" size="small" placeholder="YYYY-MM-DD" /></label>
            <div class="license-actions">
              <el-button size="small" @click="editingLicense = false">取消</el-button>
              <el-button type="primary" size="small" :loading="saving" @click="saveLicense">保存</el-button>
            </div>
          </div>
        </div>

        <div class="section-label">章节结构 · 共 {{ chapterCount }} 章</div>
        <el-table :data="detail.chapters" size="small" style="width: 100%">
          <el-table-column prop="no" label="#" width="50" />
          <el-table-column prop="title" label="章节" min-width="160" />
          <el-table-column prop="page" label="起始页" width="80" />
          <el-table-column prop="questionCount" label="题目数" width="80" />
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.keyword {
  width: 220px;
}
.table-card {
  overflow: hidden;
}
.book-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.book-cover {
  flex: none;
  width: 30px;
  height: 38px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--yxp-accent);
}
.cover--math {
  background: #0f6b5c;
}
.cover--physics {
  background: #175cd3;
}
.cover--chem {
  background: #b54708;
}
.book-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.book-meta small {
  color: var(--yxp-faint);
  font-size: 11px;
}
.license-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
}
.detail-head {
  display: flex;
  gap: 14px;
}
.book-cover--lg {
  width: 56px;
  height: 72px;
  border-radius: 8px;
  font-size: 24px;
  background: linear-gradient(145deg, #0f6b5c, #0a3f36);
}
.detail-title-wrap {
  min-width: 0;
}
.detail-title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 2px;
}
.detail-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.license-card {
  margin-top: 20px;
  padding: 14px;
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
  background: #fbfcfd;
}
.license-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.license-note {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--yxp-faint);
}
.license-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.license-grid div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
}
.license-grid span {
  color: var(--yxp-faint);
  font-size: 11px;
}
.license-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.license-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.license-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.section-label {
  margin: 22px 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--yxp-muted);
}
</style>
