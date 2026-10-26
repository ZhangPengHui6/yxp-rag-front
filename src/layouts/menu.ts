import type { Component } from 'vue'
import {
  Odometer,
  UploadFilled,
  Reading,
  Collection,
  Share,
  EditPen,
  Checked,
  Upload,
  DataAnalysis,
  ChatDotRound,
  Setting
} from '@element-plus/icons-vue'

export interface MenuItem {
  path: string
  label: string
  icon: Component
  permission: string | string[]
  badge?: string
}

export interface MenuGroup {
  title: string
  items: MenuItem[]
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: '知识生产',
    items: [
      { path: '/dashboard', label: '工作台', icon: Odometer, permission: 'dashboard.view' },
      { path: '/ingestion', label: '内容接入', icon: UploadFilled, permission: 'ingestion.view' },
      { path: '/textbooks', label: '教材', icon: Reading, permission: 'textbook.view' },
      { path: '/questions', label: '题库', icon: Collection, permission: 'question.view' }
    ]
  },
  {
    title: '质量控制',
    items: [
      { path: '/knowledge', label: '知识点', icon: Share, permission: 'knowledge.view' },
      { path: '/annotation', label: '校对', icon: EditPen, permission: 'annotation.view', badge: '128' },
      { path: '/review', label: '审核', icon: Checked, permission: 'review.view', badge: '24' }
    ]
  },
  {
    title: '发布运营',
    items: [
      { path: '/publish', label: '发布', icon: Upload, permission: 'publish.view' },
      { path: '/evaluation', label: '评测', icon: DataAnalysis, permission: 'evaluation.view' }
    ]
  },
  {
    title: '学员服务',
    items: [
      { path: '/chat', label: '学员问答', icon: ChatDotRound, permission: 'dashboard.view' }
    ]
  },
  {
    title: '平台',
    items: [
      {
        path: '/system',
        label: '系统设置',
        icon: Setting,
        permission: ['iam.user', 'iam.role', 'iam.dict', 'iam.tenant', 'iam.audit']
      }
    ]
  }
]
