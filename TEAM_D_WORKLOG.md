# Team D 工作日志

> 本文档记录 Team D 在 Vibe Reader 项目中的工作内容、版本迭代与工程化实践。

---

## 一、项目概述

- **项目代号**：Mercury Vibecoding（仓库保留）
- **应用名**：Vibe Reader（v0.2.0 起重命名）
- **类型**：基于 Electron + Vue 3 的本地优先桌面 RSS 阅读器
- **D 组职责**：基础设施 & 集成
  - 项目脚手架与构建配置
  - IPC 规范与 contextBridge 桥接
  - SQLite 数据库 Schema 与迁移
  - 全局布局
  - 跨平台打包配置
  - CI/CD 自动化
  - 项目文档

---

## 二、版本迭代记录

### v0.1.0（2026-06-09）：首版发布

**交付内容**：
- 项目脚手架（TypeScript + Vue 3 + Vite + Electron）
- SQLite 数据库 6 张表 + 迁移机制
- 25 个 IPC 通道
- macOS arm64 dmg/zip 打包

### v0.2.0（2026-06-16）：应用更名 + Team B/C 改动集成

**交付内容**：
- 应用更名：Mercury Vibecoding → Vibe Reader
- 集成 Team B 内嵌浏览器阅读模式改进（滚动条修复、403 fallback）
- 集成 Team C 流式摘要生成（SSE 推送）与 AI 结果持久化
- 44/44 单元测试通过
- macOS arm64 三平台构建首次完整跑通

**工程决策**：
- 应用更名属破坏性变更，发新 tag v0.2.0 而非覆盖 v0.1.0，保留历史版本
- userData 目录由 `mercury-vibecoding/` 变更为 `Vibe Reader/`，文档补充迁移说明

### v0.2.1（2026-06-16）：自定义应用图标

**交付内容**：
- 设计并集成 1024×1024 应用图标（`build/icon.png`）
- electron-builder 配置三平台 icon 字段
- 自动生成 macOS `.icns` / Windows `.ico` / Linux 多尺寸
- `.gitignore` 例外配置保留 `build/icon.*` 入仓

### v0.2.4（2026-06-17）：CI/CD 跨平台自动化

**目标**：实现 push tag 自动触发三平台构建 + Release 发布。

**方案选型**：
- GitHub Actions 矩阵构建（公开仓库免费额度）
- Tag-driven release 工作流
- 三平台并行（macos-latest / windows-latest / ubuntu-latest）

**工作流设计**（`.github/workflows/release.yml`）：
- 触发条件：`push tag v*` 启动完整流程；`push main` 仅跑测试；`workflow_dispatch` 手动触发
- 测试矩阵：Node.js 22 + 24（覆盖 `node:sqlite` 跨版本兼容性）
- 构建矩阵：macOS dmg+zip / Windows nsis / Linux AppImage+deb
- 缓存：通过 `setup-node` 自动缓存 npm 依赖
- 发布：`softprops/action-gh-release` 自动上传产物至 Releases

**实施过程**：经过三轮迭代解决以下工程问题
1. electron-builder 自动发布机制与 token 权限冲突 → 配置 `publish: null` 禁用，由 release job 统一处理
2. Linux 构建缺失 `dist:linux` 脚本 → 补全打包脚本
3. Linux deb 目标需 `author` 字段含 email → 补全 package.json 元数据

**结果**：v0.2.4 起，三平台并行构建约 8-10 分钟完成，6/6 jobs 全绿。

### v0.2.5（2026-06-24）：UI 体验迭代集成

**集成改动**：
- Team A：侧栏折叠面板文本/图标自适应；删除冗余 Header 栏回收垂直空间
- Team B：内嵌浏览器支持前进/后退/刷新（webContents 导航栈）
- Team C：流式摘要非阻塞（SSE + `ai:summaryChunk` IPC）；AI 结果持久化（`aiResultService.ts` + `ai:getLatestResults` IPC）
- Team D：版本管理 + CI 自动构建发布

---

## 三、技术实现概览

### 3.1 IPC 通道清单

| 方向 | 数量 | 用途 |
|---|---|---|
| R → M（ipcMain.handle） | 31 | 订阅源、文章、AI、笔记、标签、Provider 管理 |
| M → R（webContents.send） | 4 | 流式摘要推送、翻译分段推送、应用日志 |

**核心文件**：
- `electron/preload.cjs`：contextBridge 安全桥接 4 命名空间（teamAApi / teamBApi / teamCApi / teamDApi）
- `src/electronMain.ts`：主进程 IPC handler 注册
- `frontend/src/api/client.ts`：渲染进程 API 客户端，自动切换桌面 IPC / 开发模式 HTTP

### 3.2 数据库 Schema

10 张表 + 增量迁移机制：

| 表 | 用途 |
|---|---|
| feeds | RSS 订阅源 |
| entries | 文章条目 + 清洗正文缓存 |
| llm_providers | AI Provider 配置 |
| llm_usage | Token 用量记录 |
| notes | 笔记 |
| tags | 标签 |
| entry_tags | 文章-标签关联 |
| aiResults | AI 结果持久化（v0.2.5 新增） |

**核心文件**：`src/database.ts`（166 行）

### 3.3 后端服务层

| 文件 | 用途 |
|---|---|
| `src/logger.ts` | 统一日志，M→R 推送 |
| `src/notesService.ts` | 笔记 CRUD |
| `src/tagsService.ts` | 标签 CRUD + 关联 |
| `src/usageService.ts` | AI 用量记录 |

### 3.4 全局布局

`frontend/src/App.vue`：三栏布局（Feed Sidebar / Entry List / Detail Pane）+ 全局日志通知。

### 3.5 打包配置

`package.json` `build` 字段：
- appId: `com.vibe-reader`
- productName: `Vibe Reader`
- icon: `build/icon.png`（自动生成多平台多尺寸）
- 目标：macOS dmg+zip / Windows nsis / Linux AppImage+deb
- `publish: null`（由 CI release job 统一发布）

---

## 四、最终交付清单

### 代码（D 组实现）
| 文件 | 用途 |
|---|---|
| `electron/preload.cjs` | contextBridge 桥接 |
| `src/electronMain.ts` | 主进程 IPC |
| `src/database.ts` | SQLite 数据库 + 迁移 |
| `src/logger.ts` | 统一日志 |
| `src/notesService.ts` | 笔记服务 |
| `src/tagsService.ts` | 标签服务 |
| `src/usageService.ts` | 用量记录服务 |
| `frontend/src/api/client.ts` | 双通道 API 客户端 |
| `frontend/src/App.vue` | 全局布局 |
| `.github/workflows/release.yml` | CI/CD 工作流 |

### 配置
- `package.json`：依赖、脚本、electron-builder 配置
- `tsconfig.json`：TypeScript 编译配置
- `build/icon.png`：应用图标
- `.gitignore`：构建产物与依赖排除规则

### 文档
- `README.md`：项目总览
- `TEAM_D.md`：D 组规格书
- `INSTALL_GUIDE.md`：用户安装指南
- `TEST_DATA.md`：演示测试数据
- `DEMO_GUIDE.md`：演示脚本
- `.github/workflows/README.md`：CI/CD 使用说明

### Release 历史

| 版本 | 日期 | 平台 | 关键内容 |
|---|---|---|---|
| v0.1.0 | 2026-06-09 | macOS arm64 | 首版（Mercury Vibecoding） |
| v0.2.0 | 2026-06-16 | macOS arm64 | 更名 Vibe Reader + Team B/C 集成 |
| v0.2.1 | 2026-06-16 | macOS arm64 | 自定义应用图标 |
| v0.2.4 | 2026-06-17 | 三平台 | CI/CD 跨平台首次完整跑通 |
| v0.2.5 | 2026-06-24 | 三平台 | UI 体验迭代（折叠、流式、内嵌浏览器导航） |

---

## 五、工程决策记录

### 5.1 发版策略
- **代码改动**：push main 自动跑测试，不发版
- **要发版**：bump version + tag + push tag → CI 自动三平台构建 + Release
- **CI 迭代期**：中间版本号（v0.2.2 / v0.2.3）仅用于内部调试

### 5.2 应用更名处理
- 仓库保留 `mercury-vibecoding` 代号（课程作业历史标识）
- 应用 `productName` 改为 `Vibe Reader`
- v0.1.0 → v0.2.0 userData 路径变更，文档补充迁移说明

### 5.3 跨平台构建方案
- GitHub Actions 矩阵构建（vs. 本地多机手动打包）
- 优势：免费额度、可重复、跨平台一致性、其他组 push 即自动测试
- 缺点：CI 迭代期需多轮调试

---

## 六、后续可优化项

| 项 | 价值 | 备注 |
|---|---|---|
| macOS 代码签名 + notarize | 商业发布必需 | 需 Apple Developer 证书 |
| Windows arm64 包 | 覆盖 Surface 等设备 | CI 矩阵扩展 |
| Test coverage CI 上传 | 工程化指标 | c8 / istanbul |
| DMG 背景图设计 | macOS 安装体验 | 设计稿 + electron-builder 配置 |
| 自动 release notes 模板 | 版本说明标准化 | GitHub release.yml 配置 |

---

**文档版本**：1.0
**最后更新**：2026-06-26
**作者**：Team D（陈岩松）、Claude（Anthropic）
