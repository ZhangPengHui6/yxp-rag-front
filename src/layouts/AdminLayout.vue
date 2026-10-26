<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown, Bell, Search, SwitchButton } from '@element-plus/icons-vue'
import { MENU_GROUPS } from './menu'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const groups = computed(() =>
  MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => auth.has(item.permission))
  })).filter((group) => group.items.length > 0)
)

const currentTitle = computed(() => (route.meta.title as string) || '工作台')
const initials = computed(() => auth.displayName.slice(0, 1))

async function onCommand(command: string) {
  if (command === 'logout') {
    await auth.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
    return
  }
  ElMessage.info('该功能将在后续版本开放')
}

function openSearch() {
  if (auth.has('question.view')) router.push('/questions')
  else ElMessage.info('当前角色没有题库访问权限')
}
</script>

<template>
  <div class="admin">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">Y</div>
        <div class="brand-text">
          <div class="brand-name">YXP 知识库</div>
          <div class="brand-sub">教研管理台</div>
        </div>
      </div>

      <nav class="nav">
        <div v-for="group in groups" :key="group.title" class="nav-group">
          <div class="nav-group-title">{{ group.title }}</div>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            active-class="is-active"
          >
            <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
          </router-link>
        </div>
      </nav>

      <div class="sidebar-foot">
        <span class="env-dot" />
        <span class="env-name">POC 环境</span>
        <span class="env-ver">v0.1.0</span>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="crumb">
          <span class="crumb-root">知识库</span>
          <span class="crumb-sep">/</span>
          <span class="crumb-current">{{ currentTitle }}</span>
        </div>

        <div class="top-actions">
          <button class="top-search" type="button" @click="openSearch">
            <el-icon><Search /></el-icon>
            <span>搜索题目、知识点…</span>
            <kbd>Ctrl K</kbd>
          </button>

          <span class="tenant-chip text-ellipsis">{{ auth.user?.tenant || '未绑定租户' }}</span>

          <button class="icon-btn" type="button" title="通知">
            <el-icon><Bell /></el-icon>
            <i class="dot-badge" />
          </button>

          <el-dropdown trigger="click" @command="onCommand">
            <button class="profile" type="button">
              <span class="avatar">{{ initials }}</span>
              <span class="profile-meta">
                <strong>{{ auth.displayName }}</strong>
                <small>{{ auth.roleName }}</small>
              </span>
              <el-icon class="profile-arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  {{ auth.user?.username }} · {{ auth.roleName }}
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--yxp-bg);
}

.sidebar {
  width: var(--yxp-sidebar-width);
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--yxp-surface);
  border-right: 1px solid var(--yxp-border);
}

.brand {
  height: var(--yxp-topbar-height);
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  border-bottom: 1px solid var(--yxp-border);
}

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--yxp-accent);
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.brand-sub {
  font-size: 11px;
  color: var(--yxp-faint);
  margin-top: 1px;
}

.nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 12px 20px;
}

.nav-group + .nav-group {
  margin-top: 18px;
}

.nav-group-title {
  padding: 0 10px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--yxp-faint);
  letter-spacing: 0.6px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--yxp-muted);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: var(--yxp-bg);
  color: var(--yxp-text);
}

.nav-item.is-active {
  background: var(--yxp-accent-weak);
  color: var(--yxp-accent);
  font-weight: 600;
}

.nav-icon {
  font-size: 16px;
}

.nav-label {
  flex: 1;
}

.nav-badge {
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--yxp-danger-weak);
  color: var(--yxp-danger);
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-item.is-active .nav-badge {
  background: #fff;
}

.sidebar-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 12px 18px;
  border-top: 1px solid var(--yxp-border);
  color: var(--yxp-faint);
  font-size: 11px;
}

.env-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--yxp-success);
}

.env-name {
  color: var(--yxp-muted);
}

.env-ver {
  margin-left: auto;
  font-family: 'JetBrains Mono', Consolas, monospace;
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: var(--yxp-topbar-height);
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 24px;
  background: var(--yxp-surface);
  border-bottom: 1px solid var(--yxp-border);
}

.crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  min-width: 0;
}

.crumb-root,
.crumb-sep {
  color: var(--yxp-faint);
}

.crumb-current {
  color: var(--yxp-text);
  font-weight: 600;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.top-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 260px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--yxp-border);
  border-radius: 8px;
  background: var(--yxp-bg);
  color: var(--yxp-faint);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

.top-search span {
  flex: 1;
  text-align: left;
}

.top-search kbd {
  font-family: inherit;
  font-size: 10px;
  border: 1px solid var(--yxp-border-strong);
  border-radius: 4px;
  padding: 1px 4px;
  background: var(--yxp-surface);
  color: var(--yxp-faint);
}

.tenant-chip {
  max-width: 170px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--yxp-bg);
  color: var(--yxp-muted);
  font-size: 12px;
}

.icon-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--yxp-border);
  background: var(--yxp-surface);
  color: var(--yxp-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-btn:hover {
  color: var(--yxp-accent);
  border-color: var(--yxp-accent);
}

.dot-badge {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--yxp-danger);
}

.profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
  font-family: inherit;
}

.profile:hover {
  background: var(--yxp-bg);
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--yxp-accent-weak);
  color: var(--yxp-accent);
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
}

.profile-meta strong {
  font-size: 12px;
  font-weight: 600;
  color: var(--yxp-text);
}

.profile-meta small {
  font-size: 10px;
  color: var(--yxp-faint);
}

.profile-arrow {
  color: var(--yxp-faint);
  font-size: 12px;
}

.content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 1200px) {
  .top-search {
    width: 180px;
  }
  .tenant-chip {
    display: none;
  }
}
</style>
