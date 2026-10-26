<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, CircleCheck, Close, Plus, Refresh, WarningFilled } from '@element-plus/icons-vue'
import { publishApi } from '@/api'
import type { PublishOrder } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'

const status = ref('all')
const orders = ref<PublishOrder[]>([])
const total = ref(0)
const loading = ref(false)
const selected = ref<PublishOrder | null>(null)
const acting = ref(false)

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'staged', label: '已暂存' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'failed', label: '失败' },
  { value: 'rolled_back', label: '已回滚' }
]

const actionState = computed(() => ({
  stage: selected.value?.status === 'draft',
  commit: selected.value?.status === 'staged',
  rollback: selected.value?.status === 'published'
}))

const passedChecks = computed(
  () => selected.value?.checks.filter((check) => check.passed).length ?? 0
)

async function load() {
  loading.value = true
  try {
    const result = await publishApi.list({
      page: 1,
      pageSize: 20,
      status: status.value === 'all' ? undefined : status.value
    })
    orders.value = result.items
    total.value = result.total
    selected.value = result.items[0] ?? null
  } finally {
    loading.value = false
  }
}

function onStatusChange() {
  load()
}

async function createOrder() {
  try {
    const order = await publishApi.create({ target: 'production' })
    ElMessage.success('发布单已创建，请先暂存索引')
    await load()
    selected.value = order
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  }
}

const CONFIRM_TEXT: Record<'stage' | 'commit' | 'rollback', { title: string; message: string; button: string }> = {
  stage: {
    title: '暂存索引',
    message: '将把当前待发布内容写入新索引，线上服务不受影响。',
    button: '开始暂存'
  },
  commit: {
    title: '提交发布',
    message: '将原子切换线上别名，提交后 30 秒内可一键回滚。',
    button: '确认提交'
  },
  rollback: {
    title: '回滚版本',
    message: '将把线上别名切回上一个稳定版本，当前版本保留以便排查。',
    button: '确认回滚'
  }
}

async function act(type: 'stage' | 'commit' | 'rollback') {
  const order = selected.value
  if (!order) return
  const text = CONFIRM_TEXT[type]
  try {
    await ElMessageBox.confirm(text.message, text.title, {
      confirmButtonText: text.button,
      cancelButtonText: '取消',
      type: type === 'rollback' ? 'warning' : 'info'
    })
  } catch {
    return
  }
  acting.value = true
  try {
    const updated = await publishApi[type](order.id)
    selected.value = updated
    const index = orders.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) orders.value[index] = updated
    ElMessage.success(`${text.title}完成`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    acting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <PageHeader title="发布" subtitle="生成发布单、校验索引健康度，原子切换线上别名并支持回滚">
      <template #actions>
        <button class="ghost-btn" type="button" @click="load">
          <el-icon><Refresh /></el-icon>刷新
        </button>
        <button v-permission="'publish.create'" class="primary-btn" type="button" @click="createOrder">
          <el-icon><Plus /></el-icon>新建发布单
        </button>
      </template>
    </PageHeader>

    <div class="toolbar">
      <div class="toolbar-group">
        <el-select v-model="status" size="small" style="width: 130px" @change="onStatusChange">
          <el-option
            v-for="option in STATUS_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
      <span class="text-faint">共 {{ total }} 个发布单 · 当前线上别名见右侧</span>
    </div>

    <div v-loading="loading" class="split publish-split">
      <aside class="card order-list">
        <div class="card-head">
          <div class="card-title">发布单</div>
          <span class="chip">{{ orders.length }}</span>
        </div>
        <div class="order-scroll">
          <button
            v-for="order in orders"
            :key="order.id"
            type="button"
            class="order-item"
            :class="{ 'is-active': selected?.id === order.id }"
            @click="selected = order"
          >
            <div class="order-top">
              <span class="mono order-id">{{ order.id }}</span>
              <StatusTag kind="publish" :status="order.status" />
            </div>
            <div class="order-meta">
              <span>{{ order.createdBy }}</span>
              <span>{{ order.createdAt }}</span>
            </div>
            <div class="order-alias mono">→ {{ order.alias.chunks }}</div>
          </button>
          <div v-if="orders.length === 0" class="empty">暂无发布单</div>
        </div>
      </aside>

      <section class="card order-detail">
        <template v-if="selected">
          <div class="detail-head">
            <div>
              <div class="detail-meta">
                <StatusTag kind="publish" :status="selected.status" />
                <span class="chip">目标：{{ selected.target }}</span>
                <span class="text-faint">{{ selected.createdBy }} · {{ selected.createdAt }}</span>
              </div>
              <h2 class="detail-title mono">{{ selected.id }}</h2>
            </div>
            <div class="alias-box">
              <div><span>chunks 别名</span><code>{{ selected.alias.chunks }}</code></div>
              <div><span>questions 别名</span><code>{{ selected.alias.questions }}</code></div>
            </div>
          </div>

          <div class="detail-body">
            <div class="section-label">变更摘要</div>
            <div class="change-grid">
              <div v-for="change in selected.changes" :key="change.label" class="change-tile">
                <span class="change-label">{{ change.label }}</span>
                <strong :class="`val--${change.tone}`">{{ change.value }}</strong>
              </div>
            </div>

            <div class="section-head">
              <div class="section-label" style="margin: 0">发布前检查</div>
              <span class="text-faint">{{ passedChecks }} / {{ selected.checks.length }} 项通过</span>
            </div>
            <ul class="check-list">
              <li v-for="check in selected.checks" :key="check.label" :class="{ 'is-failed': !check.passed }">
                <span class="check-icon">
                  <el-icon v-if="check.passed"><CircleCheck /></el-icon>
                  <el-icon v-else><WarningFilled /></el-icon>
                </span>
                <div>
                  <strong>{{ check.label }}</strong>
                  <small>{{ check.detail }}</small>
                </div>
              </li>
            </ul>

            <div class="section-label">发布阶段</div>
            <div class="stage-row">
              <div
                v-for="(stage, index) in selected.stages"
                :key="stage.key"
                class="stage-item"
                :class="`is-${stage.status}`"
              >
                <span class="stage-dot">
                  <el-icon v-if="stage.status === 'done'"><Check /></el-icon>
                  <el-icon v-else-if="stage.status === 'failed'"><Close /></el-icon>
                  <span v-else>{{ index + 1 }}</span>
                </span>
                <strong>{{ stage.title }}</strong>
                <small>{{ stage.description }}</small>
              </div>
            </div>

            <div v-if="selected.note" class="note-box">
              <span class="dot dot--info" />{{ selected.note }}
            </div>
          </div>

          <div class="action-bar">
            <span class="text-faint action-hint">
              提交为原子切换，仅 publish.commit 权限可执行；回滚窗口 30 秒。
            </span>
            <el-button
              v-permission="'publish.commit'"
              size="small"
              :disabled="!actionState.stage || acting"
              @click="act('stage')"
            >
              暂存索引
            </el-button>
            <el-button
              v-permission="'publish.commit'"
              type="primary"
              size="small"
              :disabled="!actionState.commit || acting"
              @click="act('commit')"
            >
              提交发布
            </el-button>
            <el-button
              v-permission="'publish.rollback'"
              type="danger"
              plain
              size="small"
              :disabled="!actionState.rollback || acting"
              @click="act('rollback')"
            >
              回滚
            </el-button>
          </div>
        </template>
        <div v-else class="empty">请选择左侧发布单</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.publish-split {
  flex: 1;
  min-height: 540px;
}
.order-list {
  width: 340px;
  flex: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.order-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.order-item {
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
.order-item:hover {
  border-color: var(--yxp-border-strong);
  background: #fbfcfd;
}
.order-item.is-active {
  border-color: var(--yxp-accent);
  box-shadow: 0 0 0 2px var(--yxp-accent-weak);
}
.order-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.order-id {
  font-size: 11px;
  color: var(--yxp-text);
  font-weight: 600;
}
.order-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--yxp-faint);
}
.order-alias {
  color: var(--yxp-accent);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-detail {
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
  gap: 18px;
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
  font-size: 17px;
  font-weight: 700;
}
.alias-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: none;
}
.alias-box div {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--yxp-faint);
}
.alias-box code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 10px;
  background: var(--yxp-bg);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--yxp-muted);
}
.detail-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 20px 18px;
}
.section-label {
  margin: 16px 0 9px;
  font-size: 12px;
  font-weight: 600;
  color: var(--yxp-muted);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
}
.change-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.change-tile {
  padding: 10px 12px;
  border: 1px solid var(--yxp-border);
  border-radius: 9px;
  background: #fbfcfd;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.change-label {
  font-size: 10px;
  color: var(--yxp-faint);
}
.change-tile strong {
  font-size: 16px;
  font-weight: 700;
}
.val--success {
  color: var(--yxp-success);
}
.val--info {
  color: var(--yxp-info);
}
.val--accent {
  color: var(--yxp-accent);
}
.val--danger {
  color: var(--yxp-danger);
}
.val--muted {
  color: var(--yxp-muted);
}
.check-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.check-list li {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 11px;
  border: 1px solid var(--yxp-border);
  border-radius: 9px;
}
.check-icon {
  color: var(--yxp-success);
  font-size: 15px;
  margin-top: 1px;
}
.check-list li.is-failed {
  border-color: #f4c7c3;
  background: #fffbfa;
}
.check-list li.is-failed .check-icon {
  color: var(--yxp-danger);
}
.check-list strong {
  display: block;
  font-size: 12px;
  font-weight: 600;
}
.check-list small {
  display: block;
  margin-top: 1px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.stage-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.stage-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 12px;
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
  position: relative;
}
.stage-item.is-running {
  border-color: var(--yxp-accent);
  background: var(--yxp-accent-weak);
}
.stage-item.is-failed {
  border-color: #f4c7c3;
  background: #fffbfa;
}
.stage-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--yxp-bg);
  color: var(--yxp-faint);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  margin-bottom: 4px;
}
.stage-item.is-done .stage-dot {
  background: var(--yxp-success-weak);
  color: var(--yxp-success);
}
.stage-item.is-running .stage-dot {
  background: var(--yxp-info-weak);
  color: var(--yxp-info);
}
.stage-item.is-failed .stage-dot {
  background: var(--yxp-danger-weak);
  color: var(--yxp-danger);
}
.stage-item strong {
  font-size: 12px;
  font-weight: 600;
}
.stage-item small {
  font-size: 11px;
  color: var(--yxp-faint);
  line-height: 1.5;
}
.note-box {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 16px;
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--yxp-bg);
  color: var(--yxp-muted);
  font-size: 11px;
  line-height: 1.6;
}
.action-bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--yxp-border);
  background: #fbfcfd;
}
.action-hint {
  margin-right: auto;
  font-size: 10px;
}
@media (max-width: 1400px) {
  .change-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 1300px) {
  .order-list {
    width: 300px;
  }
  .stage-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
