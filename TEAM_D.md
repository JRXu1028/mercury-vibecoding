# Team D: 基础设施 & 集成组

> 成员: 陈岩松 (@LingXi-fur)
> 职责: 项目脚手架、IPC 规范、数据库 schema、全局布局、打包配置、文档
> 交付标准: 应用能稳定启动，各组模块能接入，最终可以打包演示

---

## 1. 项目架构

```
┌─────────────────────────────────────────────────┐
│  Renderer (Vue 3 + Vite + Element Plus + Pinia) │
│  frontend/src/                                   │
│  ├── App.vue                 全局3栏布局+日志通知  │
│  ├── components/                                 │
│  │   ├── FeedSidebar.vue     [Team A] 订阅源列表  │
│  │   ├── EntryListPane.vue   [Team A] 文章列表    │
│  │   └── EntryDetailPane.vue [Team B/C] 阅读+AI   │
│  ├── stores/feed.ts          Pinia 全局状态       │
│  ├── api/client.ts           API 客户端(四桥接)   │
│  └── types.ts                前端类型定义          │
├─────────────────────────────────────────────────┤
│  Preload (contextBridge)                         │
│  electron/preload.cjs                            │
│  暴露: window.teamAApi / teamBApi / teamCApi /   │
│        teamDApi                                  │
├─────────────────────────────────────────────────┤
│  Main Process (Electron + Node.js)               │
│  src/                                            │
│  ├── electronMain.ts         Electron 入口+IPC   │
│  ├── demoServer.ts           HTTP 开发服务器      │
│  ├── cli.ts                  CLI 交互式调试工具   │
│  ├── index.ts                模块导出入口         │
│  ├── database.ts             SQLite 数据库+迁移   │
│  ├── models.ts               共享类型定义          │
│  ├── utils.ts                共享工具(nowIso等)   │
│  ├── logger.ts               [Team D] 统一日志    │
│  ├── notesService.ts         [Team D] 笔记CRUD    │
│  ├── tagsService.ts          [Team D] 标签CRUD    │
│  ├── usageService.ts         [Team D] AI用量记录   │
│  ├── feedService.ts          [Team A] Feed CRUD   │
│  ├── feedParser.ts           [Team A] RSS 解析    │
│  ├── contentService.ts       [Team B] 正文清洗    │
│  ├── opmlService.ts          [Team A] OPML 导入导出│
│  └── ai/                     [Team C] AI 总结翻译  │
└─────────────────────────────────────────────────┘
```

## 2. 数据库 Schema

### 2.1 已实现 (6 张数据表 + 1 张关联表)

| 表名 | 所属组 | 用途 |
|------|--------|------|
| `feeds` | Team A | RSS 订阅源 |
| `entries` | Team A/B | 文章条目 + 清洗正文缓存 |
| `llm_providers` | Team D/C | AI 提供商配置 |
| `llm_usage` | Team D/C | Token 用量记录 |
| `notes` | Team D | 笔记 (Week 4 协作) |
| `tags` | Team D | 标签 (Week 4 协作) |
| `entry_tags` | Team D | 文章-标签关联 |

### 2.2 表结构详情

```sql
-- feeds: RSS 订阅源
CREATE TABLE feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  site_url TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at TEXT
);

-- entries: 文章条目
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  summary TEXT,
  content_html TEXT,
  content_md TEXT,
  content_fetched_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(feed_id, guid)
);

-- llm_providers: AI 提供商注册
CREATE TABLE llm_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  api_base_url TEXT,
  api_key_env_var TEXT,
  default_model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- llm_usage: AI 调用用量记录
CREATE TABLE llm_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,       -- 'summarize' | 'translate'
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- notes: 阅读笔记
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- tags: 标签
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL
);

-- entry_tags: 文章-标签多对多
CREATE TABLE entry_tags (
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(entry_id, tag_id)
);
```

## 3. IPC 通道清单

### 3.1 通道列表 (electronMain.ts → preload.cjs → client.ts)

| 通道名 | 方向 | 参数 | 返回值 | 所属 | 前端API |
|--------|------|------|--------|------|---------|
| `feed:list` | R→M | - | `FeedItem[]` | A | `teamAApi` |
| `feed:add` | R→M | `{url}` | `AddFeedResponse` | A | `teamAApi` |
| `feed:remove` | R→M | `{feedId}` | `void` | A | `teamAApi` |
| `feed:sync` | R→M | `{feedId}` | `SyncResponse` | A | `teamAApi` |
| `feed:syncAll` | R→M | - | `Array<{feedId,newEntryCount}>` | A | `teamAApi` |
| `entry:list` | R→M | `{feedId?,q?}` | `EntryItem[]` | A | `teamAApi` |
| `opml:import` | R→M | `{content}` | `{imported,failed}` | A | `teamAApi` |
| `opml:export` | R→M | - | `string` (OPML XML) | A | `teamAApi` |
| `opml:openFile` | R→M | - | `{filePath,content}\|null` | A | `teamAApi` |
| `opml:saveFile` | R→M | `{content}` | `string\|null` (路径) | A | `teamAApi` |
| `entry:content` | R→M | `{entryId,forceRefresh?}` | `EntryContent` | B | `teamCApi` |
| `ai:summarizeEntry` | R→M | `{entryId,...SummaryOptions,forceRefreshContent?}` | `SummaryResult` | C | `teamCApi` |
| `ai:translateEntry` | R→M | `{entryId,...TranslationOptions,forceRefreshContent?}` | `TranslationResult` | C | `teamCApi` |
| `notes:list` | R→M | `{entryId?}` | `NoteItem[]` | D | `teamBApi` |
| `notes:create` | R→M | `{entryId,content,title?}` | `NoteItem` | D | `teamBApi` |
| `notes:update` | R→M | `{noteId,title?,content?}` | `NoteItem` | D | `teamBApi` |
| `notes:delete` | R→M | `{noteId}` | `void` | D | `teamBApi` |
| `tags:list` | R→M | - | `TagWithCount[]` | D | `teamBApi` |
| `tags:create` | R→M | `{name,color?}` | `TagItem` | D | `teamBApi` |
| `tags:update` | R→M | `{tagId,name?,color?}` | `TagItem` | D | `teamBApi` |
| `tags:delete` | R→M | `{tagId}` | `void` | D | `teamBApi` |
| `tags:addToEntry` | R→M | `{entryId,tagId}` | `void` | D | `teamBApi` |
| `tags:removeFromEntry` | R→M | `{entryId,tagId}` | `void` | D | `teamBApi` |
| `tags:getForEntry` | R→M | `{entryId}` | `TagItem[]` | D | `teamBApi` |
| `app:log` | M→R | `LogEntry` | (事件推送) | D | `teamDApi.onAppLog` |

### 3.2 开发模式双通道

Electron 桌面模式下通过 `ipcRenderer.invoke` 通信；纯前端开发模式下通过 HTTP (demoServer.ts) 通信。`api/client.ts` 中的各 API 对象自动切换：

| 前端 API | 桌面模式 | HTTP 模式 |
|----------|----------|-----------|
| `teamAApi` | `window.teamAApi.*` | `fetch /api/...` |
| `teamBApi` | `window.teamBApi.*` | `fetch /api/notes, /api/tags, ...` |
| `teamCApi` | `window.teamCApi.*` | `fetch /api/entries/:id/content` (AI操作仅桌面) |
| `teamDApi` | `window.teamDApi.onAppLog` | 无 HTTP fallback |

### 3.3 已解决问题

- ~~AI 相关 API 也挂在 `teamAApi` 下，命名模糊~~ → 已拆分为 `teamCApi`
- ~~没有 `Main→Renderer` 方向的推送通道~~ → 已通过 `app:log` + `teamDApi.onAppLog` 实现

## 4. 全局布局

`App.vue` 实现标准 Mercury 3栏布局:

```
┌──────────────────────────────────────────┐
│  Header (Mercury Vibecoding + controls)  │
├────────┬────────────────┬────────────────┤
│ Feed   │  Entry List    │  Detail Pane   │
│ Sidebar│  (搜索+列表)    │  (阅读器+AI)   │
│ (Team A)│ (Team A)       │  (Team B+C)    │
│ 260px  │  360px         │  flex:1        │
└────────┴────────────────┴────────────────┘
```

所属:
- FeedSidebar, EntryListPane → Team A
- EntryDetailPane (reader + AI summary/translation) → Team B + Team C
- 全局状态 (selectedFeedId, selectedEntryId, searchText) → Pinia `useFeedStore`

## 5. 启动与开发

```bash
# 纯前端开发 (HTTP 模式，不需 Electron)
npm run dev:server   # 启动后端 127.0.0.1:5811
npm --prefix frontend run dev   # 启动前端 127.0.0.1:5173

# Electron 桌面开发 (一键)
npm run dev:desktop

# 运行测试
npm test
```

## 6. 打包与发布

### 6.1 打包命令

```bash
# 仅打包（不生成安装包，输出到 release/ 目录）
npm run pack

# 生成可分发安装包（dmg/zip/nsis/AppImage）
npm run dist
```

### 6.2 打包配置 (package.json "build" 字段)

- **macOS**: dmg + zip (Apple Silicon arm64)
- **Windows**: nsis 安装包
- **Linux**: AppImage + deb

数据库路径使用 `app.getPath('userData')`，打包后数据存在用户目录而非应用包内，升级不丢数据。

### 6.3 已发布版本

| 版本 | 平台 | 下载链接 |
|------|------|----------|
| v0.1.0 | macOS arm64 | [GitHub Release](https://github.com/JRXu1028/mercury-vibecoding/releases/tag/v0.1.0) |

### 6.4 用户安装说明

**macOS**:
1. 下载 `.dmg` → 双击打开 → 拖入 Applications
2. 或下载 `.zip` → 解压 → 双击 `Mercury Vibecoding.app`
3. 首次打开若提示"无法验证开发者"：右键点击应用 → "打开" → 确认

**使用 DeepSeek AI**:
在终端中设置环境变量后启动应用：
```bash
export DEEPSEEK_API_KEY=your-key
open -a "Mercury Vibecoding"
```

### 6.5 已知打包限制

- 当前仅打包了 macOS arm64 版本；Windows/Linux 需在对应平台执行 `npm run dist`
- 未配置代码签名和公证 (notarization)，macOS 需手动绕过 Gatekeeper
- 应用图标使用 Electron 默认图标，尚未配置自定义图标

## 7. 待办 (按优先级)

| 优先级 | 任务 | 状态 |
|--------|------|------|
| P0 | 扩展数据库 schema (4新表) | ✅ 完成 |
| P0 | TEAM_D.md + IPC 清单 | ✅ 完成 |
| P1 | 统一日志系统 (Week 4) | ✅ 完成 |
| P1 | 前端桥接 API 命名空间整理 | ✅ 完成 |
| P1 | 主进程→渲染进程事件推送通道 | ✅ 完成 |
| P2 | electron-builder 打包配置 | ✅ 完成 |
| P2 | macOS arm64 打包发布 | ✅ 完成 |
| P2 | notes CRUD 服务 | ✅ 完成 |
| P2 | tags CRUD 服务 | ✅ 完成 |
| P2 | AI 用量记录 + Provider 持久化 | ✅ 完成 |
| P3 | API Key 持久化存储 | ⬜ 待做 |
| P3 | notes/tags 前端 UI 组件 | ⬜ 待做 |
| P3 | LLM 用量查询 IPC + 前端展示 | ⬜ 待做 |
| P3 | Windows/Linux 打包发布 | ⬜ 待做 |
| P3 | 应用图标 + 代码签名 | ⬜ 待做 |
