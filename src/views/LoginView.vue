<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, Lock, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const submitting = ref(false)
const form = reactive({ username: 'admin', password: '123456' })

async function submit() {
  if (!form.username.trim() || !form.password.trim()) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  submitting.value = true
  try {
    const user = await auth.login({ username: form.username.trim(), password: form.password })
    ElMessage.success(`欢迎回来，${user.name}`)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    router.replace(redirect)
  } catch (error) {
    const message =
      error instanceof ApiError ? `${error.message}（请求号 ${error.requestId}）` : '登录失败，请稍后重试'
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <section class="brand-panel">
      <div class="brand-top">
        <div class="brand-mark">Y</div>
        <span class="brand-title">YXP 知识管理平台</span>
      </div>

      <div class="brand-copy">
        <h1>让教研知识<br />成为可检索的资产</h1>
        <p>从教材接入、结构化校对，到知识点治理与索引发布，一条链路管理 K12 知识库。</p>
        <ul class="brand-points">
          <li><span>01</span> 版面与公式识别，低置信度人工校对</li>
          <li><span>02</span> 知识点树与覆盖分析，定位内容缺口</li>
          <li><span>03</span> 索引暂存、灰度校验与一键回滚</li>
        </ul>
      </div>

      <div class="brand-foot">
        <span>POC · v0.1.0</span>
        <span>希望学 · 教研中心</span>
      </div>
    </section>

    <section class="form-panel">
      <div class="login-card">
        <h2>登录管理台</h2>
        <p class="login-sub">使用教研平台账号登录，权限由角色统一分配</p>

        <form class="login-form" @submit.prevent="submit">
          <label class="field">
            <span class="field-label">用户名</span>
            <el-input v-model="form.username" size="large" placeholder="请输入用户名" :prefix-icon="User" />
          </label>
          <label class="field">
            <span class="field-label">密码</span>
            <el-input
              v-model="form.password"
              type="password"
              size="large"
              show-password
              placeholder="请输入密码"
              :prefix-icon="Lock"
              @keyup.enter="submit"
            />
          </label>

          <button class="submit-btn" type="submit" :disabled="submitting">
            <span>{{ submitting ? '登录中…' : '登录' }}</span>
            <el-icon><ArrowRight /></el-icon>
          </button>
        </form>

        <p class="login-foot">登录即代表同意平台数据使用规范 · 遇到问题请联系平台管理员</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  height: 100vh;
  background: var(--yxp-bg);
}

.brand-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 56px;
  background: linear-gradient(145deg, #0f6b5c 0%, #0a3f36 100%);
  color: #fff;
  overflow: hidden;
}

.brand-panel::before,
.brand-panel::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.brand-panel::before {
  width: 520px;
  height: 520px;
  right: -180px;
  top: -160px;
}

.brand-panel::after {
  width: 320px;
  height: 320px;
  right: -60px;
  bottom: -120px;
  background: rgba(255, 255, 255, 0.04);
}

.brand-top {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  z-index: 1;
}

.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.brand-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.brand-copy {
  position: relative;
  z-index: 1;
  max-width: 460px;
}

.brand-copy h1 {
  margin: 0;
  font-size: 40px;
  line-height: 1.28;
  letter-spacing: -0.6px;
  font-weight: 700;
}

.brand-copy > p {
  margin: 18px 0 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 14px;
  line-height: 1.75;
}

.brand-points {
  list-style: none;
  margin: 34px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.brand-points li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
}

.brand-points span {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  padding: 2px 8px;
}

.brand-foot {
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: 1;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}

.form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.login-card {
  width: min(400px, 100%);
  background: var(--yxp-surface);
  border: 1px solid var(--yxp-border);
  border-radius: 16px;
  padding: 36px 34px 26px;
  box-shadow: 0 18px 50px rgba(16, 24, 40, 0.06);
}

.login-card h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.login-sub {
  margin: 8px 0 26px;
  color: var(--yxp-muted);
  font-size: 12px;
  line-height: 1.6;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--yxp-muted);
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  margin-top: 6px;
  border: none;
  border-radius: 9px;
  background: var(--yxp-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--yxp-accent-hover);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: default;
}

.login-foot {
  margin: 22px 0 0;
  color: var(--yxp-faint);
  font-size: 10px;
  line-height: 1.6;
  text-align: center;
}

@media (max-width: 1000px) {
  .login {
    grid-template-columns: 1fr;
  }
  .brand-panel {
    display: none;
  }
}
</style>
