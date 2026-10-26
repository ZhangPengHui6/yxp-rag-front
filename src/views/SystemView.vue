<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { iamApi } from '@/api'
import { PERMISSIONS, ROLES } from '@/constants/permissions'
import { useAuthStore } from '@/stores/auth'
import type { AuditLog, RoleRow, Tenant, User } from '@/types'
import PageHeader from '@/components/PageHeader.vue'

const auth = useAuthStore()

const TABS = [
  { name: 'users', label: '用户', permission: 'iam.user' },
  { name: 'roles', label: '角色与权限', permission: 'iam.role' },
  { name: 'dicts', label: '字典', permission: 'iam.dict' },
  { name: 'tenants', label: '租户', permission: 'iam.tenant' },
  { name: 'audit', label: '审计日志', permission: 'iam.audit' }
]

const tabs = computed(() => TABS.filter((tab) => auth.has(tab.permission)))
const activeTab = ref('')

const loading = ref(false)
const users = ref<User[]>([])
const roles = ref<RoleRow[]>([])
const dicts = ref<Record<string, string[]>>({})
const tenants = ref<Tenant[]>([])
const audit = ref<AuditLog[]>([])
const auditActor = ref('')
const auditAction = ref('')

const DICT_TITLES: Record<string, string> = {
  subject: '学科',
  stage: '学段',
  question_type: '题型',
  difficulty: '难度'
}

const permissionCount = computed(() =>
  auth.permissions.includes('*') ? PERMISSIONS.length : auth.permissions.length
)

const permissionLabels = computed(() => {
  const map: Record<string, string> = {}
  PERMISSIONS.forEach((permission) => {
    map[permission.code] = permission.label
  })
  return map
})

const rolePermissions = computed(() => {
  const map: Record<string, string[]> = {}
  ROLES.forEach((role) => {
    map[role.code] = role.permissions
  })
  return map
})

function permissionLabel(code: string) {
  if (code === '*') return '全部权限'
  return permissionLabels.value[code] ?? code
}

function rolePerms(code: string) {
  return rolePermissions.value[code] ?? []
}

async function loadUsers() {
  loading.value = true
  try {
    const result = await iamApi.users({ page: 1, pageSize: 50 })
    users.value = result.items
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  loading.value = true
  try {
    roles.value = await iamApi.roles()
  } finally {
    loading.value = false
  }
}

async function loadDicts() {
  loading.value = true
  try {
    dicts.value = await iamApi.dicts()
  } finally {
    loading.value = false
  }
}

async function loadTenants() {
  loading.value = true
  try {
    const result = await iamApi.tenants({ page: 1, pageSize: 50 })
    tenants.value = result.items
  } finally {
    loading.value = false
  }
}

async function loadAudit() {
  loading.value = true
  try {
    const result = await iamApi.audit({
      page: 1,
      pageSize: 50,
      actor: auditActor.value || undefined,
      action: auditAction.value || undefined
    })
    audit.value = result.items
  } finally {
    loading.value = false
  }
}

function loadActive() {
  switch (activeTab.value) {
    case 'users':
      loadUsers()
      break
    case 'roles':
      loadRoles()
      break
    case 'dicts':
      loadDicts()
      break
    case 'tenants':
      loadTenants()
      break
    case 'audit':
      loadAudit()
      break
    default:
      break
  }
}

function onTabChange(name: string | number) {
  activeTab.value = String(name)
  loadActive()
}

function reload() {
  loadActive()
  ElMessage.success('已刷新')
}

onMounted(() => {
  activeTab.value = tabs.value[0]?.name ?? 'users'
  loadActive()
})
</script>

<template>
  <div class="page">
    <PageHeader title="系统设置" subtitle="管理用户、角色权限、字典、租户与审计日志；所有变更会写入审计">
      <template #actions>
        <button class="ghost-btn" type="button" @click="reload">
          <el-icon><Refresh /></el-icon>刷新
        </button>
      </template>
    </PageHeader>

    <section class="card role-banner">
      <div>
        <div class="banner-label">当前登录角色</div>
        <div class="banner-role">
          {{ auth.roleName }}
          <span class="chip chip--accent">{{ permissionCount }} 项权限</span>
        </div>
        <div class="banner-sub">{{ auth.user?.tenant }} · 用户 {{ auth.user?.username }}</div>
      </div>
      <p class="banner-note">
        角色权限遵循最小授权原则；新增权限需同步更新前端路由、按钮与后端接口校验。
      </p>
    </section>

    <section class="card tab-card">
      <el-tabs v-model="activeTab" class="tabs" @tab-change="onTabChange">
        <el-tab-pane v-for="tab in tabs" :key="tab.name" :label="tab.label" :name="tab.name">
          <div v-loading="loading" class="tab-body">
            <template v-if="tab.name === 'users'">
              <el-table :data="users" size="small" style="width: 100%">
                <el-table-column label="成员" min-width="160">
                  <template #default="{ row }">
                    <div class="member-cell">
                      <span class="member-avatar">{{ row.name.slice(0, 1) }}</span>
                      <div>
                        <div class="member-name">{{ row.name }}</div>
                        <div class="mono text-faint">{{ row.username }}</div>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="角色" width="130">
                  <template #default="{ row }">
                    <span class="chip chip--accent">{{ row.roleName }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="tenant" label="租户" min-width="170" />
                <el-table-column prop="lastLoginAt" label="最近登录" width="150" />
                <el-table-column label="状态" width="90">
                  <template #default><span class="chip chip--success">启用</span></template>
                </el-table-column>
              </el-table>
            </template>

            <template v-else-if="tab.name === 'roles'">
              <el-table :data="roles" size="small" style="width: 100%">
                <el-table-column type="expand">
                  <template #default="{ row }">
                    <div class="perm-panel">
                      <span
                        v-for="code in rolePerms(row.code)"
                        :key="code"
                        class="chip"
                        :class="{ 'chip--accent': code === '*' }"
                      >
                        {{ permissionLabel(code) }}
                      </span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="角色" width="180">
                  <template #default="{ row }">
                    <div class="role-name">{{ row.name }}</div>
                    <div class="mono text-faint">{{ row.code }}</div>
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="说明" min-width="280" show-overflow-tooltip />
                <el-table-column prop="userCount" label="用户数" width="90" />
                <el-table-column label="权限数" width="100">
                  <template #default="{ row }">
                    <span class="mono">{{ row.permissionCount }}</span>
                  </template>
                </el-table-column>
              </el-table>
              <div class="table-hint">展开行可查看该角色拥有的权限码；权限明细见《权限分配手册》。</div>
            </template>

            <template v-else-if="tab.name === 'dicts'">
              <div class="dict-grid">
                <div v-for="(values, key) in dicts" :key="key" class="dict-card">
                  <div class="dict-head">
                    <strong>{{ DICT_TITLES[key] || key }}</strong>
                    <span class="mono text-faint">{{ key }}</span>
                  </div>
                  <div class="dict-tags">
                    <span v-for="value in values" :key="value" class="chip">{{ value }}</span>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="tab.name === 'tenants'">
              <el-table :data="tenants" size="small" style="width: 100%">
                <el-table-column prop="name" label="租户" min-width="200" />
                <el-table-column label="类型" width="100">
                  <template #default="{ row }"><span class="chip">{{ row.plan }}</span></template>
                </el-table-column>
                <el-table-column prop="users" label="用户数" width="100" />
                <el-table-column label="状态" width="100">
                  <template #default="{ row }">
                    <span class="chip" :class="row.status === 'active' ? 'chip--success' : 'chip--muted'">
                      {{ row.status === 'active' ? '正常' : '已暂停' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="id" label="租户 ID" width="140">
                  <template #default="{ row }"><span class="mono">{{ row.id }}</span></template>
                </el-table-column>
              </el-table>
            </template>

            <template v-else-if="tab.name === 'audit'">
              <div class="audit-filter">
                <el-input v-model="auditActor" size="small" placeholder="操作人" clearable style="width: 150px" />
                <el-input v-model="auditAction" size="small" placeholder="动作，如 publish.commit" clearable style="width: 220px" />
                <el-button size="small" @click="loadAudit">查询</el-button>
                <span class="text-faint">仅保留最近 180 天，导出请联系平台管理员</span>
              </div>
              <el-table :data="audit" size="small" style="width: 100%">
                <el-table-column prop="createdAt" label="时间" width="150" />
                <el-table-column prop="actor" label="操作人" width="110" />
                <el-table-column label="动作" width="170">
                  <template #default="{ row }"><span class="mono">{{ row.action }}</span></template>
                </el-table-column>
                <el-table-column label="对象" min-width="180">
                  <template #default="{ row }"><span class="mono text-muted">{{ row.target }}</span></template>
                </el-table-column>
                <el-table-column prop="ip" label="IP" width="130">
                  <template #default="{ row }"><span class="mono">{{ row.ip }}</span></template>
                </el-table-column>
              </el-table>
            </template>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<style scoped>
.role-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 20px;
}
.banner-label {
  font-size: 11px;
  color: var(--yxp-faint);
}
.banner-role {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
  font-size: 16px;
  font-weight: 700;
}
.banner-sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--yxp-muted);
}
.banner-note {
  margin: 0;
  max-width: 460px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--yxp-faint);
}
.tab-card {
  padding: 0 18px 18px;
}
.tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
.tabs :deep(.el-tabs__item) {
  font-size: 13px;
  height: 44px;
}
.tab-body {
  min-height: 220px;
}
.member-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}
.member-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--yxp-accent-weak);
  color: var(--yxp-accent);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.member-name {
  font-size: 12px;
  font-weight: 600;
}
.role-name {
  font-size: 12px;
  font-weight: 600;
}
.perm-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 16px 12px 48px;
}
.table-hint {
  margin-top: 10px;
  font-size: 11px;
  color: var(--yxp-faint);
}
.dict-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.dict-card {
  padding: 13px 14px;
  border: 1px solid var(--yxp-border);
  border-radius: 10px;
  background: #fbfcfd;
}
.dict-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.dict-head strong {
  font-size: 12px;
  font-weight: 600;
}
.dict-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.audit-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
@media (max-width: 1100px) {
  .role-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
