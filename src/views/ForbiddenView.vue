<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Lock } from '@element-plus/icons-vue'

const router = useRouter()
</script>

<template>
  <div class="forbidden">
    <div class="forbidden-card">
      <div class="forbidden-icon"><el-icon><Lock /></el-icon></div>
      <div class="forbidden-code">403</div>
      <h1>没有访问权限</h1>
      <p>当前账号的角色未被授予该模块的访问权限。如需开通，请联系平台管理员调整角色。</p>
      <div class="forbidden-actions">
        <button class="primary-btn" type="button" @click="router.push('/dashboard')">返回工作台</button>
        <button class="ghost-btn" type="button" @click="router.back()">返回上一页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forbidden {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--yxp-bg);
  padding: 24px;
}
.forbidden-card {
  width: 420px;
  max-width: 100%;
  padding: 40px 36px;
  background: var(--yxp-surface);
  border: 1px solid var(--yxp-border);
  border-radius: 16px;
  text-align: center;
}
.forbidden-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto;
  border-radius: 12px;
  background: var(--yxp-accent-weak);
  color: var(--yxp-accent);
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.forbidden-code {
  margin-top: 16px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--yxp-faint);
}
.forbidden-card h1 {
  margin: 6px 0 0;
  font-size: 22px;
  font-weight: 700;
}
.forbidden-card p {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--yxp-muted);
}
.forbidden-actions {
  margin-top: 24px;
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>
