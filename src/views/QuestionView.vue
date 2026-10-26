<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CopyDocument, Download, Refresh, Search } from '@element-plus/icons-vue'
import { questionApi } from '@/api'
import type { DuplicatePair, VariantDraft } from '@/api'
import { stageLabel } from '@/constants/status'
import type { Question } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'

const router = useRouter()

const query = reactive({
  page: 1,
  pageSize: 10,
  status: 'all',
  type: 'all',
  difficulty: 'all',
  keyword: ''
})
const questions = ref<Question[]>([])
const total = ref(0)
const loading = ref(false)

const drawer = ref(false)
const detail = ref<Question | null>(null)
const variants = ref<VariantDraft[]>([])
const variantLoading = ref(false)

const dupDialog = ref(false)
const dupLoading = ref(false)
const duplicates = ref<DuplicatePair[]>([])

const DIFFICULTY_TONE: Record<string, string> = { 易: 'success', 中: 'warning', 难: 'danger' }

async function load() {
  loading.value = true
  try {
    const result = await questionApi.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status === 'all' ? undefined : query.status,
      type: query.type === 'all' ? undefined : query.type,
      difficulty: query.difficulty === 'all' ? undefined : query.difficulty,
      keyword: query.keyword || undefined
    })
    questions.value = result.items
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  query.page = 1
  load()
}

async function openDetail(row: Question) {
  detail.value = row
  drawer.value = true
  variants.value = []
  variantLoading.value = true
  try {
    variants.value = await questionApi.variants(row.id)
  } catch {
    variants.value = []
  } finally {
    variantLoading.value = false
  }
}

async function openDuplicates() {
  dupDialog.value = true
  dupLoading.value = true
  try {
    duplicates.value = await questionApi.duplicates()
  } finally {
    dupLoading.value = false
  }
}

function goImport() {
  ElMessage.info('题目随教材一起入库，请上传试卷或题集文件')
  router.push('/ingestion')
}

onMounted(load)
</script>

<template>
  <div class="page">
    <PageHeader title="题库" subtitle="按学科、题型与知识点管理题目，支持变式生成与重复题检测">
      <template #actions>
        <button class="ghost-btn" type="button" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </button>
        <button
          v-permission="'question.dedupe'"
          class="ghost-btn"
          type="button"
          @click="openDuplicates"
        >
          <el-icon><CopyDocument /></el-icon>重复检测
        </button>
        <button v-permission="'question.import'" class="primary-btn" type="button" @click="goImport">
          <el-icon><Download /></el-icon>导入题目
        </button>
      </template>
    </PageHeader>

    <div class="toolbar">
      <div class="toolbar-group">
        <el-input
          v-model="query.keyword"
          class="keyword"
          placeholder="搜索题干内容"
          clearable
          size="small"
          :prefix-icon="Search"
          @keyup.enter="applyFilter"
          @clear="applyFilter"
        />
        <el-select v-model="query.type" size="small" style="width: 110px" @change="applyFilter">
          <el-option label="全部题型" value="all" />
          <el-option label="选择题" value="选择题" />
          <el-option label="填空题" value="填空题" />
          <el-option label="解答题" value="解答题" />
        </el-select>
        <el-select v-model="query.difficulty" size="small" style="width: 100px" @change="applyFilter">
          <el-option label="全部难度" value="all" />
          <el-option label="易" value="易" />
          <el-option label="中" value="中" />
          <el-option label="难" value="难" />
        </el-select>
        <el-select v-model="query.status" size="small" style="width: 110px" @change="applyFilter">
          <el-option label="全部状态" value="all" />
          <el-option label="草稿" value="draft" />
          <el-option label="审核中" value="reviewing" />
          <el-option label="已发布" value="published" />
          <el-option label="已归档" value="archived" />
        </el-select>
        <el-button size="small" @click="applyFilter">查询</el-button>
      </div>
      <span class="text-faint">共 {{ total }} 道题</span>
    </div>

    <section class="card table-card">
      <el-table v-loading="loading" :data="questions" size="small" style="width: 100%">
        <el-table-column label="题干" min-width="320">
          <template #default="{ row }">
            <div class="stem">{{ row.stem }}</div>
            <div class="mono text-faint">{{ row.id }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="题型" width="80" />
        <el-table-column label="难度" width="76">
          <template #default="{ row }">
            <span class="chip" :class="`chip--${DIFFICULTY_TONE[row.difficulty] || 'muted'}`">
              {{ row.difficulty }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="知识点" min-width="180">
          <template #default="{ row }">
            <div class="kp-cell">
              <span v-for="kp in row.knowledgePoints.slice(0, 2)" :key="kp" class="chip">{{ kp }}</span>
              <span v-if="row.knowledgePoints.length > 2" class="text-faint">
                +{{ row.knowledgePoints.length - 2 }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="92">
          <template #default="{ row }"><StatusTag kind="question" :status="row.status" /></template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="120" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">查看</el-button>
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

    <el-drawer v-model="drawer" size="600px" title="题目详情">
      <template v-if="detail">
        <div class="q-meta">
          <StatusTag kind="question" :status="detail.status" />
          <span class="chip">{{ detail.type }}</span>
          <span class="chip" :class="`chip--${DIFFICULTY_TONE[detail.difficulty]}`">
            难度 {{ detail.difficulty }}
          </span>
          <span class="chip">{{ detail.subject }} · {{ stageLabel(detail.stage) }}</span>
        </div>

        <p class="q-stem">{{ detail.stem }}</p>

        <div v-if="detail.options?.length" class="q-options">
          <div v-for="option in detail.options" :key="option.key" class="q-option">
            <span class="option-key">{{ option.key }}</span>
            <span>{{ option.text }}</span>
          </div>
        </div>

        <div class="answer-box">
          <span>参考答案</span>
          <strong>{{ detail.answer }}</strong>
        </div>

        <div class="section-label">解析</div>
        <p class="q-analysis">{{ detail.analysis }}</p>

        <div class="section-label">知识点</div>
        <div class="q-meta">
          <span v-for="kp in detail.knowledgePoints" :key="kp" class="chip chip--accent">{{ kp }}</span>
        </div>

        <div class="section-label">来源</div>
        <p class="q-source">{{ detail.source }}</p>

        <div class="section-head">
          <div class="section-label" style="margin: 0">变式草稿</div>
          <el-button
            v-permission="'question.variant'"
            size="small"
            :loading="variantLoading"
            @click="openDetail(detail)"
          >
            重新生成
          </el-button>
        </div>
        <div v-loading="variantLoading" class="variant-list">
          <div v-for="variant in variants" :key="variant.id" class="variant-item">
            <span class="chip chip--accent">{{ variant.transform }}</span>
            <span class="chip">{{ variant.difficulty }}</span>
            <p>{{ variant.stem }}</p>
          </div>
          <div v-if="!variantLoading && variants.length === 0" class="empty">暂无变式草稿</div>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="dupDialog" title="重复题检测" width="720px">
      <div v-loading="dupLoading" class="dup-list">
        <div v-for="pair in duplicates" :key="pair.id" class="dup-item">
          <div class="dup-head">
            <span class="chip chip--warning">相似度 {{ (pair.score * 100).toFixed(0) }}%</span>
            <span class="text-faint">{{ pair.suggestion }}</span>
          </div>
          <div class="dup-pair">
            <div>
              <small class="text-faint">当前题目</small>
              <p>{{ pair.left.stem }}</p>
            </div>
            <div>
              <small class="text-faint">疑似重复</small>
              <p>{{ pair.right.stem }}</p>
            </div>
          </div>
        </div>
        <div v-if="!dupLoading && duplicates.length === 0" class="empty">未检测到重复题</div>
      </div>
      <template #footer>
        <el-button size="small" @click="dupDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.keyword {
  width: 220px;
}
.table-card {
  overflow: hidden;
}
.stem {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.55;
  color: var(--yxp-text);
}
.kp-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
}
.q-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.q-stem {
  margin: 16px 0 0;
  font-size: 14px;
  line-height: 1.8;
  color: var(--yxp-text);
}
.q-options {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.q-option {
  display: flex;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--yxp-border);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
}
.option-key {
  font-weight: 700;
  color: var(--yxp-accent);
}
.answer-box {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--yxp-accent-weak);
  color: var(--yxp-accent);
  font-size: 12px;
}
.answer-box strong {
  font-size: 14px;
}
.section-label {
  margin: 20px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--yxp-muted);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
}
.q-analysis,
.q-source {
  margin: 0;
  font-size: 12px;
  line-height: 1.75;
  color: var(--yxp-muted);
  white-space: pre-wrap;
}
.variant-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 40px;
}
.variant-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px;
  border: 1px solid var(--yxp-border);
  border-radius: 8px;
}
.variant-item p {
  width: 100%;
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--yxp-muted);
}
.dup-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 80px;
}
.dup-item {
  padding: 12px;
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
}
.dup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.dup-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 8px;
}
.dup-pair p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--yxp-muted);
}
</style>
