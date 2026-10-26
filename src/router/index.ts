import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    permission?: string | string[]
    public?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '工作台', permission: 'dashboard.view' }
      },
      {
        path: 'ingestion',
        name: 'ingestion',
        component: () => import('@/views/IngestionView.vue'),
        meta: { title: '内容接入', permission: 'ingestion.view' }
      },
      {
        path: 'textbooks',
        name: 'textbooks',
        component: () => import('@/views/TextbookView.vue'),
        meta: { title: '教材', permission: 'textbook.view' }
      },
      {
        path: 'questions',
        name: 'questions',
        component: () => import('@/views/QuestionView.vue'),
        meta: { title: '题库', permission: 'question.view' }
      },
      {
        path: 'knowledge',
        name: 'knowledge',
        component: () => import('@/views/KnowledgeView.vue'),
        meta: { title: '知识点', permission: 'knowledge.view' }
      },
      {
        path: 'annotation',
        name: 'annotation',
        component: () => import('@/views/AnnotationView.vue'),
        meta: { title: '校对', permission: 'annotation.view' }
      },
      {
        path: 'review',
        name: 'review',
        component: () => import('@/views/ReviewView.vue'),
        meta: { title: '审核', permission: 'review.view' }
      },
      {
        path: 'publish',
        name: 'publish',
        component: () => import('@/views/PublishView.vue'),
        meta: { title: '发布', permission: 'publish.view' }
      },
      {
        path: 'evaluation',
        name: 'evaluation',
        component: () => import('@/views/EvaluationView.vue'),
        meta: { title: '评测', permission: 'evaluation.view' }
      },
      {
        path: 'chat',
        name: 'chat',
        component: () => import('@/views/ChatView.vue'),
        meta: { title: '学员问答', permission: 'dashboard.view' }
      },
      {
        path: 'system',
        name: 'system',
        component: () => import('@/views/SystemView.vue'),
        meta: {
          title: '系统设置',
          permission: ['iam.user', 'iam.role', 'iam.dict', 'iam.tenant', 'iam.audit']
        }
      }
    ]
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { title: '无访问权限', public: true }
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    if (to.name === 'login' && auth.isLoggedIn) return { path: '/dashboard' }
    return true
  }

  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!auth.user) {
    try {
      await auth.fetchProfile()
    } catch {
      auth.clear()
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }

  if (to.meta.permission && !auth.has(to.meta.permission)) {
    return { path: '/403' }
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · YXP 知识管理平台` : 'YXP 知识管理平台'
})
