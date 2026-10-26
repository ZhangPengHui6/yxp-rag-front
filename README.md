# YXP 知识管理平台 · 前端

K12 知识库管理后台，覆盖内容接入、教材、题库、知识点、校对、审核、发布、评测、系统设置与学员问答。
基于 `docs/front/yxp_front.pen` 的 9 屏设计稿实现，管理接口路径与《概要设计总纲》`/admin/v1` 保持一致。

后端主仓库为 [yxp-edu-rag](https://github.com/ZhangPengHui6/yxp-edu-rag)（管理端 `apps/admin-api` + 学员端 `apps/kb-api`），本仓库只包含运营前端。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 产物输出 dist/
npm run typecheck  # vue-tsc 类型检查
```

前端只连接真实后端，不再内置 Mock 数据。本地开发需要先启动 `apps/admin-api`：

```bash
# .env.development
VITE_API_BASE=/admin/v1
VITE_PROXY_TARGET=http://127.0.0.1:8000
```

`vite.config.ts` 会把 `/admin/v1` 代理到 `VITE_PROXY_TARGET`（默认 `http://127.0.0.1:8000`）。

学员问答页 `/chat` 通过 `/v1` 代理到 `apps/kb-api`（默认 `http://127.0.0.1:8001`），配置见 `.env.development` 的 `VITE_KB_BASE` / `VITE_KB_PROXY_TARGET`。生产构建不要把 `VITE_KB_API_KEY` 打进前端包，鉴权应放在同源网关或 BFF。

## 演示账号

本地演示账号密码统一为 `123456`，仅用于开发种子数据；部署前必须修改密码或关闭 `SEED_ON_START`。

| 用户名 | 角色 | 说明 |
| --- | --- | --- |
| `admin` | 超级管理员 | 全部权限，含租户与审计 |
| `zhangwei` | 教研管理员 | 教材 / 题库 / 知识点 / 发布全流程 |
| `liyuan` | 审核员 | 审核题目、知识点、教材 |
| `chenxi` | 校对员 | 校对队列，只读教材与题库 |
| `zhaomin` | 只读访客 | 全部模块只读（租户 `tnt_bj`） |
| `sunqi` | 发布管理员 | 索引暂存、提交、回滚与评测（租户 `tnt_gz`） |

## 目录结构

```
src/
├── api/                 # Axios 实例、统一错误、按模块拆分的接口
│   └── modules/         # auth / dashboard / ingestion / textbook / ...
├── components/          # PageHeader、MetricCard、StatusTag、UploadDropzone、TrendChart
├── constants/           # 权限码与角色定义、状态字典
├── directives/          # v-permission
├── layouts/             # AdminLayout（232px 侧栏 + 60px 顶栏）与菜单配置
├── router/              # 路由表、权限守卫
├── stores/              # auth（登录态与权限）、app（字典、侧栏）
├── styles/              # 设计 token 与全局样式
├── types/               # 领域模型（对齐 docs/3_开发文档/数据对象.md）
└── views/               # 13 个页面（含登录 / 403）
```

## 前端约定

- 列表筛选由服务端完成分页与过滤；筛选状态保存在页面内，刷新后回到默认视图。
- 分页、排序均由服务端完成，前端只传参。
- 所有接口返回 `{ code, message, data, request_id }`；错误提示会展示 `request_id` 便于排查。
- 权限码统一为 `module.action`，路由 `meta.permission` 与 `v-permission` 使用同一份 `constants/permissions.ts`。
- 上传走 MinIO 预签名：`POST /ingestion/uploads` 获取 `uploadUrl` 后 PUT 文件，再创建解析任务。
- 解析任务轮询采用 3s 起步的指数退避（上限 15s），任务完成后停止。
- 颜色、圆角、间距只使用 `styles/tokens.css` 中的 `--yxp-*` / Element Plus 变量，不写裸色值。
- 权限只做前端展示控制，真实校验必须由后端按接口再次执行。

## 权限

前端权限点、角色矩阵与前端限制见后端主仓库的 `docs/front/权限分配手册.md`。
