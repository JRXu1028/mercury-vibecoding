# Team D 工作复盘（2026-06-09 → 2026-06-26）

> 完整记录 D 组在本项目中的工作过程，按时间顺序整理。可用于课程答辩、工作复盘、后续维护参考。

---

## 一、项目背景

- **项目代号**：Mercury Vibecoding（仓库保留）
- **应用名**：Vibe Reader（v0.2.0 起重命名）
- **类型**：基于 Electron + Vue 3 的桌面 RSS 阅读器
- **D 组职责**：基础设施 & 集成（项目脚手架、IPC 规范、数据库 Schema、全局布局、打包配置、文档）
- **D 组成员**：陈岩松（独立完成全部 D 组工作）

---

## 二、完整工作过程（按时间）

### 阶段 1：v0.1.0 → v0.2.0 拉取与打包（2026-06-09）

#### 任务背景
其他组（Team B / Team C）有 8 个新提交，需 D 组打包发布 v0.2.0。

#### 步骤
1. **拉取最新代码**
   - 本地已有 `5db0f30`（v0.1.0），远端 main 已到 `5711f97`
   - 本地有未提交的 `package.json` 改动 → `git stash` 暂存
   - `git pull origin main` 拉取 8 个新 commit

2. **新提交内容**
   - Team B：内嵌浏览器阅读模式改进 + 滚动条修复 + 403 fallback
   - Team C：流式摘要生成（SSE）+ AI 结果持久化

3. **测试 + 打包**
   ```
   npm install
   npm --prefix frontend install
   npm test  → 44/44 全过
   npm run dist
   ```
   产物：`Vibe Reader-0.1.0-arm64.dmg` (140MB) + `.zip` (135MB)

4. **发布 v0.2.0 Release**
   - 应用名从 "Mercury Vibecoding" → "Vibe Reader"（破坏性变更）
   - 决策：发新 tag v0.2.0 而非覆盖 v0.1.0，保留历史

5. **遇到的坑**
   - 上传 140MB dmg 到 GitHub Release 时被本地代理 reset
   - 解决：kill 卡死进程，分文件用 `gh release upload` 重传

#### 产出
- Commit: 多个（README/TEAM_D/INSTALL_GUIDE 文档同步）
- Release: [v0.2.0](https://github.com/JRXu1028/mercury-vibecoding/releases/tag/v0.2.0)

---

### 阶段 2：v0.2.0 → v0.2.1 应用图标（2026-06-16）

#### 任务背景
P3 待办「应用图标」——当前打包用 Electron 默认图标（丑）。

#### 步骤
1. **生成图标**
   - 提供 GPT-4 / Midjourney / 即梦 提示词 4 种风格
   - 选定风格后用户用 AI 生成 1024×1024 PNG

2. **接入项目**
   - 保存到 `build/icon.png`（注意：尺寸必须是 1024×1024）
   - 用户传的图是 1254×1254 → 用 `sips -z 1024 1024` 缩放
   - `package.json` 的 `build` 字段加 `"icon": "build/icon.png"`（mac/win/linux 三平台都加）
   - electron-builder 自动从一张 PNG 生成 `.icns` / `.ico` / 多尺寸

3. **`.gitignore` 问题**
   - 默认 `build/` 被 Python 模板忽略
   - 加例外：`!build/icon.png`（git 不扫描被忽略目录，需 `git add -f`）

4. **版本 + 打包**
   - bump 到 v0.2.1
   - 重新打包，验证 `icon.icns` 已生成在 app bundle 内
   - 文档全量更新（README/TEAM_D/INSTALL_GUIDE）

#### 产出
- Commit: `feat: add custom app icon + bump to v0.2.1`
- Release: [v0.2.1](https://github.com/JRXu1028/mercury-vibecoding/releases/tag/v0.2.1)

---

### 阶段 3：v0.2.1 → v0.2.4 CI/CD 跨平台自动化（2026-06-16 → 2026-06-17）

#### 任务背景
- 手动打包只能在 Mac 上做
- Windows / Linux 版本无人能打
- 其他组 push 后无法及时发版

#### 方案对比
| 方案 | 触发 | 自动化 |
|---|---|---|
| GitHub Actions（选） | push tag | 全自动 |
| 本地 cron 脚本 | 定时 | 半自动 |
| 手动 | 你想起时 | 手动 |

#### 步骤

**Step 1：发现冲突**
- 仓库已有简陋的 `build-release.yml`（无 Linux、无测试、用 `npm install` 而非 `npm ci`）
- 删除旧文件，用新写的 `release.yml` 取代

**Step 2：写 workflow**
文件 `.github/workflows/release.yml`：
- 触发：`push tag v*` 或 `workflow_dispatch`（手动）
- 测试矩阵：Node 22 + Node 24
- 构建矩阵：macos-latest / windows-latest / ubuntu-latest
- 缓存：`setup-node` 自动缓存 npm 依赖
- 发布：`softprops/action-gh-release` 自动上传产物

**Step 3：第一次跑（v0.2.2）**
- 测试 ✅
- 3 个构建全 ❌
- 原因：`GH_TOKEN` env var 触发 electron-builder 自动发 release，但 token 权限不足报 403
- 修复：在 build 步骤 `GH_TOKEN: ''`，并在 package.json 加 `"publish": null`

**Step 4：第二次跑（v0.2.3）**
- 测试 ✅
- Mac ✅ Windows ✅ Linux ❌
- 原因：`package.json` 缺 `dist:linux` script
- 修复：补 `dist:linux`

**Step 5：第三次跑（v0.2.4）**
- Mac ✅ Win ✅ Linux ❌
- 原因：Linux deb 目标要求 `author` 字段含 email
- 修复：加 `author: {name, email}` + `description`

**Step 6：第四次跑（v0.2.4 二次）**
- ✅ 全部 6/6 jobs 通过
- 自动发布：5 个产物（dmg / zip / exe / AppImage / deb）

#### 关键认知
> 跨平台 CI 一定会有平台特定坑（签名、脚本、字段），迭代修 3-4 次很正常。

#### 产出
- 文件：`.github/workflows/release.yml` + `README.md`
- 删除：`.github/workflows/build-release.yml`（旧）
- Commits：4 个修复 + 1 个清理
- Release: [v0.2.4](https://github.com/JRXu1028/mercury-vibecoding/releases/tag/v0.2.4)

---

### 阶段 4：v0.2.5 折叠面板 + 流式 + 内嵌浏览器（2026-06-24）

#### 任务背景
本周其他组有 4 大改动需打包：
1. 侧栏折叠文本适配（Team A）
2. 流式摘要非阻塞（Team C）
3. AI 结果持久化（Team C）
4. 内嵌浏览器 forward/back（Team B）
5. 应用更名 Vibe Reader（已在前阶段完成）
6. 删除冗余 Header（Team A）

#### 步骤
1. `git pull` 拉取 1 个 commit（折叠面板 + Header 删除）
2. bump 到 v0.2.5
3. `git tag v0.2.5 && git push --tags`
4. CI 自动跑通 6/6 jobs
5. 5 平台产物自动发布

#### 教训
> 平台版本不连续（v0.2.0 → v0.2.1 → v0.2.2/3/4 调试 → v0.2.5）是 CI 调试期的常态，发版前老师不必关心中间号。

#### 产出
- Commit: `chore: bump to 0.2.5`
- Release: [v0.2.5](https://github.com/JRXu1028/mercury-vibecoding/releases/tag/v0.2.5)

---

### 阶段 5：演示准备（2026-06-25 → 2026-06-26）

#### 任务
为明天的展示准备：
1. 下载最新 dmg
2. 写演示脚本（10 步流程，覆盖 6 项本周改动）
3. 更新 README（加 v0.2.5 changelog）
4. 通俗解释核心概念（IPC / Schema / CI/CD）给非技术用户

#### 产出
- `DEMO_GUIDE.md`：完整演示指南（10 步 + 8 分钟时间轴 + Q&A 预演）
- `README.md` 开发记录补 6/24 多组 entry
- 验证 Token 用量统计位置（Provider 面板，非顶部状态栏）

---

## 三、最终交付清单

### 代码（D 组实现）
| 文件 | 行数 | 用途 |
|---|---|---|
| `electron/preload.cjs` | 97 | contextBridge 安全桥接 4 命名空间 |
| `src/electronMain.ts` | 556 | 31 个 R→M IPC + 4 个 M→R 推送 |
| `src/database.ts` | 166 | 10 张表 + 增量迁移 |
| `src/logger.ts` | — | 统一日志（M→R 推送） |
| `src/notesService.ts` | — | 笔记 CRUD |
| `src/tagsService.ts` | — | 标签 CRUD + 关联 |
| `src/usageService.ts` | — | AI 用量记录（D 组创建骨架） |
| `frontend/src/api/client.ts` | 330 | 桌面 IPC + HTTP 双通道 |
| `frontend/src/App.vue` | 288 | 全局三栏布局 |
| `.github/workflows/release.yml` | 80+ | 跨平台 CI/CD |

### 配置
| 文件 | 用途 |
|---|---|
| `package.json` | 9 个 npm script + electron-builder 三平台配置 |
| `tsconfig.json` | TypeScript 编译配置 |
| `build/icon.png` | 1024×1024 应用图标 |

### 文档（D 组维护）
| 文件 | 用途 |
|---|---|
| `README.md` | 项目总览 |
| `TEAM_D.md` | D 组完整规格书 |
| `INSTALL_GUIDE.md` | 用户安装指南 |
| `TEST_DATA.md` | 演示测试数据 |
| `DEMO_GUIDE.md` | 演示脚本 |
| `.github/workflows/README.md` | CI/CD 用法 |

### Release 历史
| 版本 | 日期 | 关键内容 |
|---|---|---|
| v0.1.0 | 2026-06-09 | 首版（原 Mercury Vibecoding） |
| v0.2.0 | 2026-06-16 | 更名 Vibe Reader + Team B/C 改动 |
| v0.2.1 | 2026-06-16 | 自定义应用图标 |
| v0.2.4 | 2026-06-17 | CI/CD 跨平台首次跑通 |
| v0.2.5 | 2026-06-24 | 折叠面板 + 流式 + 内嵌浏览器 |

---

## 四、踩过的坑（按类别）

### 4.1 网络 / 代理
- **本地 HTTP 代理 127.0.0.1:1082 reset 大文件上传** → 关代理直连 TLS 又 timeout → 必须代理 + tag 触发 CI 绕开
- **直连 GitHub API 间歇 TLS timeout** → 重试 + 改用 release 直接查询

### 4.2 打包 / 构建
- **应用更名破坏 userData 路径**（`mercury-vibecoding/` → `Vibe Reader/`）→ 文档加迁移说明
- **electron-builder auto-publish 403** → `publish: null` + `GH_TOKEN: ''`
- **Linux 缺 `dist:linux` script** → 补上
- **Linux deb 要 author email** → 加 `author` 字段

### 4.3 工具链
- **claude-mem 插件 Bun 报错** → 装 Bun (`curl -fsSL https://bun.sh/install | bash`)
- **git 不扫描被忽略目录** → 用 `git add -f` 强加 icon.png

### 4.4 文档维护
- **AI 用量统计位置写错**（误写顶部状态栏）→ 实际在 Provider 面板，DEMO_GUIDE 已更正
- **aiResultService 归属误标** → 实际 Team C 创建（D 组只有 usageService 骨架）

---

## 五、关键决策记录

### 5.1 发版策略
- **小改动** → 不发版（push main 自动跑测试）
- **要发版** → bump version + tag + push tag → CI 自动三平台 release
- **不发版的迭代期间** → 中间号（v0.2.2/v0.2.3）可以跳过对外说明

### 5.2 应用更名处理
- 仓库保留 `mercury-vibecoding` 代号（历史）
- 应用 `productName` 改为 `Vibe Reader`
- 文档头部加迁移说明（v0.1.0 → v0.2.0 userData 路径变更）

### 5.3 跳过的工作
- **代码签名 + 公证**：需 Apple Developer 99 美元/年，课设阶段跳过（用户右键打开即可）
- **Test coverage 覆盖率报告**：测试用例已 44 个，未配 CI 上传覆盖率

---

## 六、明天演示建议

### 6.1 必须展示（按优先级）
1. ⭐ **流式摘要 + 非阻塞**（Team C 大改动，演示价值最高）
2. ⭐ **AI 结果持久化**（切文章 / 重启不丢）
3. ⭐ **内嵌浏览器 forward/back**（Team B 大改动）
4. ⭐ **侧栏折叠文本适配**（Team A 本周改动）
5. 自定义图标 + 简洁 Header（视觉印象）

### 6.2 通俗解释要点
- **IPC = 服务员手册**（前端点菜、后端做菜、IPC 传单）
- **Schema = Excel 多 sheet 设计**（10 张表存不同数据）
- **CI/CD = GitHub 免费借 3 台云电脑并行打包**（8 分钟三平台齐活）

### 6.3 应急
- Gatekeeper 拦截 → 右键 → 打开
- RSS 同步失败 → 换源（HN / 阮一峰最稳）
- DeepSeek 余额不足 → 切 Mock
- AI Summary 卡 → 等几秒或重启

---

## 七、后续可优化项

| 项 | 价值 | 成本 |
|---|---|---|
| 代码签名（macOS notarize） | 演示不需，发布才需 | 99 美元/年 |
| Test coverage CI 上传 | 工程化亮点 | 1 小时 |
| 自动 release notes 模板 | 版本说明更专业 | 30 分钟 |
| Windows arm64 包 | 覆盖 Surface 等设备 | 改 matrix |
| DMG 背景图 | macOS 安装体验加分 | 设计图 + 配置 |

---

**文档版本**：1.0
**最后更新**：2026-06-26
**作者**：陈岩松（Team D） + Claude（AI 协作）
