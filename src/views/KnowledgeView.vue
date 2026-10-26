<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DataAnalysis, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { knowledgeApi } from '@/api'
import type { CoverageReport } from '@/api'
import type { KnowledgeDetail, KnowledgeNode } from '@/types'
import PageHeader from '@/components/PageHeader.vue'

const tree = ref<KnowledgeNode[]>([])
const treeLoading = ref(false)
const filterText = ref('')
const treeRef = ref()
const selectedId = ref('')

const detail = ref<KnowledgeDetail | null>(null)
const detailLoading = ref(false)

const coverage = ref<CoverageReport | null>(null)
const coverageVisible = ref(false)
const coverageLoading = ref(false)

const treeProps = { label: 'name', children: 'children' }

function filterNode(value: string, data: KnowledgeNode) {
  if (!value) return true
  return data.name.includes(value)
}

watch(filterText, (value) => treeRef.value?.filter(value))

const coverageTone = computed(() => {
  const rate = coverage.value?.rate ?? 0
  if (rate >= 0.85) return 'success'
  if (rate >= 0.75) return 'warning'
  return 'danger'
})

function covClass(value: number) {
  if (value >= 85) return 'cov--success'
  if (value >= 75) return 'cov--warning'
  return 'cov--danger'
}

async function loadTree() {
  treeLoading.value = true
  try {
    tree.value = await knowledgeApi.tree()
    const first = findFirstLeaf(tree.value)
    if (first) {
      selectedId.value = first.id
      await nextTick()
      treeRef.value?.setCurrentKey(first.id)
      await loadDetail(first.id)
    }
  } finally {
    treeLoading.value = false
  }
}

function findFirstLeaf(nodes: KnowledgeNode[]): KnowledgeNode | null {
  for (const node of nodes) {
    if (node.children?.length) {
      const child = findFirstLeaf(node.children)
      if (child) return child
    } else if (node.level > 0) {
      return node
    }
  }
  return null
}

async function loadDetail(id: string) {
  detailLoading.value = true
  try {
    detail.value = await knowledgeApi.detail(id)
  } finally {
    detailLoading.value = false
  }
}

function onNodeClick(node: KnowledgeNode) {
  selectedId.value = node.id
  loadDetail(node.id)
}

async function toggleCoverage() {
  coverageVisible.value = !coverageVisible.value
  if (!coverageVisible.value || coverage.value) return
  coverageLoading.value = true
  try {
    coverage.value = await knowledgeApi.coverage()
  } finally {
    coverageLoading.value = false
  }
}

function createKnowledge() {
  ElMessage.info('知识点通过教材章节自动抽取，如需手工新增请联系教研管理员在后台创建')
}

onMounted(loadTree)
</script>

<template>
  <div class="page">
    <PageHeader title="知识点" subtitle="维护知识点树、证据链与覆盖情况，支撑 RAG 检索的召回质量">
      <template #actions>
        <button class="ghost-btn" type="button" @click="loadTree">
          <el-icon><Refresh /></el-icon>刷新
        </button>
        <button v-permission="'knowledge.coverage'" class="ghost-btn" type="button" @click="toggleCoverage">
          <el-icon><DataAnalysis /></el-icon>{{ coverageVisible ? '收起分析' : '覆盖分析' }}
        </button>
        <button v-permission="'knowledge.create'" class="primary-btn" type="button" @click="createKnowledge">
          <el-icon><Plus /></el-icon>新建知识点
        </button>
      </template>
    </PageHeader>

    <section v-if="coverageVisible" v-loading="coverageLoading" class="card coverage-card">
      <div class="card-head">
        <div>
          <div class="card-title">知识点覆盖分析</div>
          <div class="cov-sub">基于题目与知识点关联统计，缺口按模块倒序排列</div>
        </div>
        <span class="chip" :class="`chip--${coverageTone}`">
          整体覆盖 {{ coverage ? (coverage.rate * 100).toFixed(0) : 0 }}%
        </span>
      </div>
      <div class="coverage-body">
        <div class="stat-row">
          <div class="stat-tile">
            <div class="stat-value">{{ coverage?.total ?? '—' }}</div>
            <div class="stat-label">知识点总数</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">{{ coverage?.covered ?? '—' }}</div>
            <div class="stat-label">已关联题目</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">{{ coverage ? (coverage.rate * 100).toFixed(1) + '%' : '—' }}</div>
            <div class="stat-label">覆盖率</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">{{ coverage?.gaps.length ?? 0 }}</div>
            <div class="stat-label">缺口模块</div>
          </div>
        </div>
        <div class="gap-list">
          <div v-for="gap in coverage?.gaps ?? []" :key="gap.module" class="gap-row">
            <span class="gap-name">{{ gap.module }}</span>
            <el-progress
              :percentage="Math.round(gap.rate * 100)"
              :stroke-width="5"
              :show-text="false"
              class="gap-bar"
            />
            <span class="gap-meta">{{ (gap.rate * 100).toFixed(0) }}% · 缺 {{ gap.missing }} 题</span>
          </div>
        </div>
      </div>
    </section>

    <div class="knowledge-split split">
      <aside class="card tree-card">
        <div class="tree-head">
          <div class="card-title">知识点树</div>
          <span class="text-faint">{{ treeLoading ? '加载中' : '按学科 / 章节组织' }}</span>
        </div>
        <div class="tree-search">
          <el-input
            v-model="filterText"
            size="small"
            placeholder="搜索知识点"
            clearable
            :prefix-icon="Search"
          />
        </div>
        <div v-loading="treeLoading" class="tree-scroll">
          <el-tree
            ref="treeRef"
            :data="tree"
            :props="treeProps"
            node-key="id"
            default-expand-all
            highlight-current
            :expand-on-click-node="false"
            :filter-node-method="filterNode"
            @node-click="onNodeClick"
          >
            <template #default="{ data }">
              <div class="tree-node">
                <span class="tree-label ellipsis">{{ data.name }}</span>
                <span class="tree-count mono">{{ data.questionCount }}</span>
                <span class="tree-cov mono" :class="covClass(data.coverage)">{{ data.coverage }}%</span>
              </div>
            </template>
          </el-tree>
        </div>
      </aside>

      <section v-loading="detailLoading" class="card detail-card">
        <template v-if="detail">
          <div class="detail-head">
            <div>
              <div class="detail-path">{{ detail.path }}</div>
              <h2 class="detail-name">{{ detail.node.name }}</h2>
              <div class="detail-chips">
                <span class="chip chip--accent">{{ detail.code }}</span>
                <span class="chip">{{ detail.node.status === 'published' ? '已发布' : '草稿' }}</span>
              </div>
            </div>
            <div class="detail-actions">
              <el-button v-permission="'knowledge.edit'" size="small">编辑</el-button>
              <el-button v-permission="'knowledge.merge'" size="small">合并</el-button>
            </div>
          </div>

          <div class="stat-row detail-stats">
            <div class="stat-tile">
              <div class="stat-value">{{ detail.stats.questions }}</div>
              <div class="stat-label">关联题目</div>
            </div>
            <div class="stat-tile">
              <div class="stat-value">{{ detail.stats.paragraphs }}</div>
              <div class="stat-label">教材片段</div>
            </div>
            <div class="stat-tile">
              <div class="stat-value">{{ detail.stats.coverage }}%</div>
              <div class="stat-label">覆盖率</div>
            </div>
            <div class="stat-tile">
              <div class="stat-value">{{ detail.stats.prerequisites }}</div>
              <div class="stat-label">前置知识点</div>
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-col">
              <div class="section-label">教材依据</div>
              <div class="evidence-list">
                <div v-for="(item, index) in detail.evidences" :key="index" class="evidence-item">
                  <div class="evidence-meta">
                    <span class="chip chip--accent">{{ item.book }}</span>
                    <span class="text-faint">{{ item.edition }}</span>
                    <span class="evidence-loc mono">{{ item.location }}</span>
                  </div>
                  <p>{{ item.excerpt }}</p>
                </div>
              </div>
            </div>

            <div class="detail-col">
              <div class="section-label">题型分布</div>
              <div class="dist-list">
                <div v-for="item in detail.distribution" :key="item.label" class="dist-row">
                  <span class="dist-label">{{ item.label }}</span>
                  <div class="dist-bar">
                    <span :style="{ width: `${item.percent}%` }" />
                  </div>
                  <span class="mono text-faint">{{ item.count }} 题</span>
                </div>
              </div>

              <div class="section-label">关联关系</div>
              <div class="relation-list">
                <div v-for="relation in detail.relations" :key="relation.type" class="relation-row">
                  <span class="chip">{{ relation.type }}</span>
                  <div class="relation-chips">
                    <span v-for="item in relation.items" :key="item" class="chip chip--accent">{{ item }}</span>
                  </div>
                </div>
              </div>

              <div class="section-label">常见错误</div>
              <ul class="pitfall-list">
                <li v-for="item in detail.pitfalls" :key="item">
                  <span class="dot dot--warning" />{{ item }}
                </li>
              </ul>
            </div>
          </div>
        </template>
        <div v-else class="empty">请选择左侧知识点查看详情</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cov-sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.coverage-body {
  padding: 0 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.gap-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gap-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.gap-name {
  width: 190px;
  font-size: 12px;
  color: var(--yxp-text);
  flex: none;
}
.gap-bar {
  flex: 1;
}
.gap-meta {
  width: 110px;
  text-align: right;
  font-size: 11px;
  color: var(--yxp-faint);
  flex: none;
}
.knowledge-split {
  flex: 1;
  min-height: 520px;
}
.tree-card {
  width: 340px;
  flex: none;
  min-height: 0;
  overflow: hidden;
}
.tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  font-size: 11px;
}
.tree-search {
  padding: 0 12px 10px;
}
.tree-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 8px 14px;
}
.tree-scroll :deep(.el-tree) {
  background: transparent;
  font-size: 12px;
}
.tree-scroll :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 6px;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding-right: 6px;
  min-width: 0;
}
.tree-label {
  flex: 1;
  font-size: 12px;
}
.tree-count {
  color: var(--yxp-faint);
}
.tree-cov {
  width: 34px;
  text-align: right;
  font-size: 10px;
}
.cov--success {
  color: var(--yxp-success);
}
.cov--warning {
  color: var(--yxp-warning);
}
.cov--danger {
  color: var(--yxp-danger);
}
.detail-card {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 18px 20px 24px;
}
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.detail-path {
  font-size: 11px;
  color: var(--yxp-faint);
}
.detail-name {
  margin: 4px 0 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.2px;
}
.detail-chips {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.detail-actions {
  display: flex;
  gap: 6px;
  flex: none;
}
.detail-stats {
  margin-top: 18px;
}
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 24px;
  margin-top: 4px;
}
.section-label {
  margin: 20px 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--yxp-muted);
}
.evidence-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.evidence-item {
  padding: 12px;
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
  background: #fbfcfd;
}
.evidence-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.evidence-loc {
  color: var(--yxp-faint);
  margin-left: auto;
}
.evidence-item p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.75;
  color: var(--yxp-muted);
}
.dist-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.dist-label {
  width: 56px;
  color: var(--yxp-muted);
  flex: none;
}
.dist-bar {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: var(--yxp-bg);
  overflow: hidden;
}
.dist-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--yxp-accent);
}
.relation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.relation-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.relation-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.pitfall-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pitfall-list li {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--yxp-muted);
}
@media (max-width: 1300px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .tree-card {
    width: 300px;
  }
}
</style>
