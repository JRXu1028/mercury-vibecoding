# Vibe Reader 项目协作纪实

> 一段 D 组（陈岩松）与 AI 协作伙伴（智谱 GLM-5.2 / DeepSeek V4 Pro）共同完成的项目历程。
> 从 2026-06-09 首次协作到 2026-06-26 演示准备完成，记录每一次交互、决策与产出。

---

## 序章 · 起点

时间回到 2026-06-09。

陈岩松是项目 D 组（基础设施 & 集成组）的唯一成员，负责项目脚手架、IPC 规范、数据库 Schema、全局布局、打包配置与文档。其他组（A/B/C）已经陆陆续续把代码合并到了 main 分支，但 D 组需要把这些工作"打包成用户能下载的成品"。

那天陈岩松打开终端，对着 AI 协作伙伴说：

> 「你的任务是维护完成 https://github.com/JRXu1028/mercury-vibecoding，我是 D 组的，你看看这两天有没有什么更新需要我去重新迭代打包的。」

故事就从这里开始。

---

## 第一章 · v0.2.0 集成与打包（2026-06-09）

### 1.1 拉取发现

AI 伙伴先用 `gh api` 拉取了仓库最新提交：

```
5711f97 2026-06-16 Update README.md
4cfc64e 2026-06-16 Merge pull request #1 from JRXu1028/TEAM_B_fix0
c231741 2026-06-16 fix: keep embedded browser scrollbar usable
66ce31f 2026-06-16 fix: improve team b reader browser
c293492 2026-06-13 feat(team-c): persist and display latest AI results
ab4a197 2026-06-13 feat(team-c): add streaming summary generation
1d2e5c9 2026-06-12 fix: fall back when article fetch is blocked
5db0f30 2026-06-09 docs: update for Team B Reader rewrite
```

8 个新提交，涉及 Team B（阅读器改进）、Team C（流式摘要 + 持久化）。

陈岩松：**「你试试，文件都在代码文件夹目录下的同名目录的」**

AI 伙伴找到 `/Users/a123/代码/mercury-vibecoding`，确认本地仓库存在，开始处理。

### 1.2 第一个坎：未提交改动

```
modified:   frontend/package-lock.json
modified:   frontend/package.json
```

本地有未提交的 package.json 改动挡住了 pull。AI 伙伴用 `git stash` 暂存，pull 成功拉取 8 个提交。

### 1.3 测试与打包

```
npm install
npm --prefix frontend install
npm test
```

测试结果：**44/44 全过**。

```
npm run dist
```

打包成功，产物：
- `Vibe Reader-0.1.0-arm64.dmg` (140MB)
- `Vibe Reader-0.1.0-arm64-mac.zip` (135MB)

### 1.4 关键发现：应用更名

打包日志显示 `Vibe Reader.app`——其他组已经把应用从 "Mercury Vibecoding" 改名为 "Vibe Reader"。

陈岩松和 AI 伙伴讨论后决定：**发新 tag v0.2.0**，而非覆盖 v0.1.0，保留历史版本。

### 1.5 第二个坎：上传卡死

```bash
gh release create v0.2.0 \
  "release/Vibe Reader-0.1.0-arm64.dmg" \
  "release/Vibe Reader-0.1.0-arm64-mac.zip" \
  ...
```

140MB dmg 上传到 GitHub Release，卡在 0 字节不动。AI 伙伴排查发现：**本地 HTTP 代理 127.0.0.1:1082 reset 大文件上传**。

陈岩松：**「Failed with non-blocking status code: Error: Bun not found. Please install Bun」这个什么意思？**

这是 claude-mem 插件的 Bun 报错，跟项目无关。AI 伙伴解释后继续主任务。

### 1.6 文档全面同步

AI 伙伴识别出多份文档有过期引用：
- `INSTALL_GUIDE.md`：所有 "Mercury Vibecoding" → "Vibe Reader"，环境变量启动路径更新
- `README.md`：架构图标题、应用名说明
- `TEAM_D.md`：IPC 清单补 `ai:getLatestResults` + `ai:summaryChunk`，release 表加 v0.2.0
- `TEAM_C.md`：标 API Key / 持久化 / 流式为已实现

提交并推送。Release v0.2.0 完成。

---

## 第二章 · Bun 错误的插曲（2026-06-09）

打包期间陈岩松问：**「Failed with non-blocking status code: Error: Bun not found」**

AI 伙伴追溯 `claude-mem` 插件的 `bun-runner.js`：
- 第 96-102 行：找不到 Bun 直接 `exit(1)`，无 Node fallback
- 第一次尝试：改成 Node fallback → 但 `worker-service.cjs` 硬依赖 `bun:sqlite`，Node 没有

陈岩松：**「能修复吗，他报错肯定有原因呀，修复一下」**

AI 伙伴分析后决定：装 Bun。

```bash
curl -fsSL https://bun.sh/install | bash
bun --version  →  1.3.14
```

装好。Bun 报错清除。

---

## 第三章 · 应用图标 v0.2.1（2026-06-16）

### 3.1 任务缘起

陈岩松看 D 组待办：「P3 应用图标 + 代码签名」未做。AI 伙伴解释：
- **图标**：自己做，0 成本，视觉必要
- **签名**：99 美元/年 Apple Developer，课设可选

陈岩松决定先做图标。

### 3.2 GPT-5.5 提示词设计

陈岩松：**「我可以去 gpt 生成一个你给我一套生成提示词就行」**

AI 伙伴提供 4 种风格的 GPT-5.5 提示词：
1. 极简矢量
2. 现代渐变玻璃感
3. 复古印刷感
4. 抽象波形

每个都明确 1024×1024、无文字、留 squircle 裁剪边距。

### 3.3 图标接入

陈岩松生成图后保存到 `build/icon.png`。

AI 伙伴检查发现：尺寸 1254×1254，不是 1024。

```bash
sips -z 1024 1024 build/icon.png
```

修正。然后改 `package.json`：
- 加 `"directories.buildResources": "build"`
- 加 `mac.icon` / `win.icon` / `linux.icon` 都指向 `build/icon.png`
- bump 版本到 v0.2.1

### 3.4 第三个坎：.gitignore 例外

`git add build/icon.png` 失败：
```
The following paths are ignored by one of your .gitignore files: build
```

原因：Python 模板的 `.gitignore` 排除了 `build/`。AI 伙伴加例外：
```
build/
!build/icon.png
!build/icon.icns
!build/icon.ico
```

但例外不生效——git 不扫描被忽略目录。最终用 `git add -f build/icon.png` 强制入仓。

### 3.5 打包验证

```
npm run dist
```

打包日志这次**没有** "default Electron icon is used" 警告——图标生效。

```bash
ls "release/mac-arm64/Vibe Reader.app/Contents/Resources/icon.icns"
```

`.icns` 已生成在 app bundle 内。v0.2.1 发布。

---

## 第四章 · CI/CD 跨平台之战（2026-06-16 → 2026-06-17）

### 4.1 需求浮现

陈岩松：**「能不能实现一个其他组上传东西我们能及时去打包更新呀」**

AI 伙伴给出 3 方案对比：
- GitHub Actions（推荐）
- 本地 cron 脚本
- 手动打包

陈岩松确认：用 GitHub Actions。

### 4.2 发现仓库已有 workflow

AI 伙伴检查发现仓库已有简陋版 `build-release.yml`：
- 无 Linux
- 无测试 gate
- 无缓存
- 用 `npm install`（非 `npm ci`）

两者并存会冲突。AI 伙伴删了旧的，写新的 `release.yml`。

### 4.3 workflow 设计

```yaml
触发：push tag v* 或 workflow_dispatch
jobs:
  test: Node 22/24 矩阵
  build: macos/windows/ubuntu-latest 矩阵
  release: 收集 artifacts + 自动发布
```

带缓存（`setup-node` 的 `cache: 'npm'`）、artifact 上传、`softprops/action-gh-release`。

### 4.4 第一次跑 v0.2.2

CI 结果：
- Test (Node 22/24) ✅
- Build (mac/win/linux) **全部 ❌**

报错：
```
HttpError: 403 Forbidden
"Resource not accessible by integration"
```

AI 伙伴分析：electron-builder 看到 `GH_TOKEN` env var 就尝试自动发 release，但 token 在 build job 上下文权限不足。

修复：
- workflow build 步骤 `GH_TOKEN: ''`
- `package.json` 加 `"publish": null`

### 4.5 第二次跑 v0.2.3

CI 结果：
- Test ✅
- Mac ✅ Windows ✅
- Linux ❌

报错：
```
npm error Missing script: "dist:linux"
```

修复：补 `dist:linux` 脚本。

### 4.6 第三次跑 v0.2.4

CI 结果：
- Mac ✅ Win ✅ Linux ❌

报错：
```
Please specify author 'email' in the application package.json
```

Linux deb 目标要求 author email。修复：加 `author: {name, email}` + `description`。

### 4.7 第四次跑 v0.2.4（终）

```
✅ Test (Node 22)
✅ Test (Node 24)
✅ Build (macos-latest)
✅ Build (windows-latest)
✅ Build (ubuntu-latest)
✅ Publish release
```

6/6 全绿。Release 自动发布：
- `Vibe.Reader-0.2.4-arm64.dmg` (142MB)
- `Vibe.Reader-0.2.4-arm64-mac.zip` (136MB)
- `Vibe.Reader.Setup.0.2.4.exe` (117MB)
- `Vibe.Reader-0.2.4.AppImage` (154MB)
- `vibe-reader_0.2.4_amd64.deb` (118MB)

5 个产物，三平台全覆盖。**这场 CI/CD 战役历经 4 轮迭代终于胜利**。

---

## 第五章 · 网络困境（2026-06-17）

期间遇到最大网络障碍。

陈岩松问上传为什么慢。AI 伙伴排查：
- 系统代理：HTTP/HTTPS via 127.0.0.1:1082
- 大文件上传被代理 reset（unexpected EOF）
- 关代理直连 → GFW 拦截（TLS handshake timeout）

死循环：开代理被 reset，关代理被墙。

最终解决方案：**用 tag 触发 CI**，绕开本地上传。`git push --tags` 是小数据（只推 ref），不会被代理 reset。CI 在 GitHub 美国服务器跑，发布也走 GitHub 内部，跟用户网络无关。

陈岩松：**「怎么说」**
AI 伙伴：简明给出方案 → 关代理打 tag → CI 全自动。

---

## 第六章 · v0.2.5 折叠面板集成（2026-06-24）

### 6.1 又一波更新

陈岩松：**「看看有没有更新，然后我d组还需要做什么吗，打包一下」**

AI 伙伴 `git pull` 发现 1 个新提交：
```
db2bace Merge pull request #2 from JRXu1028/codex/fix-collapsed-layout
c227060 fix collapsed panes and reclaim header space
```

Team A 的折叠面板文本适配 + Header 精简。纯前端改动。

### 6.2 流程已成熟

这次流程非常顺：
1. bump 版本 → v0.2.5
2. `git tag v0.2.5 && git push --tags`
3. CI 自动跑（已配好的 workflow）
4. 8 分钟后 6/6 jobs 全绿
5. 5 平台产物自动发布

**前几章磨出来的 CI/CD 此时已经"开箱即用"**。

---

## 第六章补 · v0.2.6 文档定稿（2026-06-26）

### 6.3 演示取消后的收尾

陈岩松：**「继续好好检查一下，倒是不用演示了，就是保证最终的交付质量就行，还有几个 bug 其他组在修复」**

方向从"演示准备"转为"交付质量审计"。AI 伙伴逐文件核对版本号一致性：

| 文件 | 改动 |
|------|------|
| `README.md` | "当前最新 v0.2.5" → v0.2.6 |
| `INSTALL_GUIDE.md` | 下载文件名 0.2.1 → 0.2.6，补 Linux 行 |
| `DEMO_GUIDE.md` | dmg 文件名 0.2.5 → 0.2.6 |
| `TEAM_D.md` | 发布表补 v0.2.2 / v0.2.3 / v0.2.4 / v0.2.5 / v0.2.6 五行 |
| `package.json` | author 元数据对齐 Vibe Reader 品牌（`team-d@vibe-reader.local`） |

### 6.4 等待其他组 bug 修复

CI 工作流已成熟。其他组修复 bug 后，**bump 版本 → 打 tag → push** 即可自动触发三平台构建发布。无需人工干预。


---

## 第七章 · 演示前夕（2026-06-25 → 2026-06-26）

### 7.1 紧迫感来临

陈岩松：**「我明天要展示了，帮我 clone 最新的版本下来，教我怎么去演示这个项目」**

并明确列了本周 6 项改动：
1. 侧栏折叠时文本没做适配
2. 摘要生成时不能堵塞其他操作，用流式
3. 摘要和翻译没有持久化存储
4. 链接 app 内打开要能 back/forward，不要新开 app
5. 名字不要叫 mercury
6. 界面上方占用区域太多，删这一栏

### 7.2 演示指南撰写

AI 伙伴写了 `DEMO_GUIDE.md`，10 步流程：
- Step 1 启动与命名（#5、#6）
- Step 4 流式摘要 + 非阻塞（#2）⭐
- Step 5 AI 结果持久化（#3）⭐
- Step 6 内嵌浏览器 forward/back（#4）⭐
- Step 7 侧栏折叠文本适配（#1）⭐

每步配话术，8 分钟时间轴。

### 7.3 一个小修正

陈岩松：**「顶部状态栏可见 Token 用量统计 这个我没看见呀」**

AI 伙伴 grep 代码发现：Token 用量统计实际在 **Provider 面板底部**（齿轮图标 → 用量统计区），不是顶部状态栏。修正 DEMO_GUIDE。

### 7.4 通俗解释 IPC 与 Schema

陈岩松：**「我是小白，给我讲通俗易懂一点」**

AI 伙伴用类比讲：
- **IPC = 餐厅服务员手册**（前端点菜 / 后端做菜 / IPC 传单）
- **Schema = Excel 多 sheet 设计**（10 张表存不同数据）
- **CI/CD = GitHub 免费借 3 台云电脑并行打包**（8 分钟三平台齐活）

### 7.5 协作纪实成稿

陈岩松：**「我跟你交互的这个过程可以形成一个完整的交互过程的文档吗」**

—— 也就是本文档。

---

## 第八章 · D 组职责全景（2026-06-26 最终核对）

陈岩松：**「项目脚手架、IPC 规范、数据库 schema、全局布局、打包配置、文档我的这些负责的内容怎么体现的」**

AI 伙伴用代码 + git blame 核对，给出 D 组工作清单：

### 8.1 代码贡献

| 文件 | 行数 | 内容 | D 组独立 |
|---|---|---|---|
| `electron/preload.cjs` | 97 | contextBridge 4 命名空间 | ✅ |
| `src/electronMain.ts` | 574 | 32 R→M + 5 M→R IPC | ✅ |
| `src/database.ts` | 166 | 10 表 + 迁移 | ✅（Team C 改过 aiResults） |
| `src/logger.ts` | — | 统一日志 | ✅ |
| `src/notesService.ts` | — | 笔记 CRUD | ✅ |
| `src/tagsService.ts` | — | 标签 CRUD | ✅ |
| `src/usageService.ts` | — | AI 用量记录 | ⚠️ D 写骨架，Team C 加字段 |
| `frontend/src/api/client.ts` | 330 | 双通道 API | ✅ |
| `frontend/src/App.vue` | 288 | 三栏布局 | ✅ |
| `.github/workflows/release.yml` | 80+ | CI/CD 工作流 | ✅ |

### 8.2 关键数据

- **10 张 SQLite 数据表** + 增量迁移机制
- **32 个 R→M IPC 通道** + **5 个 M→R 推送**（共 37 个）
- **3 平台并行 CI 构建**（mac/win/linux）
- **44 个单元测试**，全过
- **10 个 Release 版本**（v0.1.0 → v0.2.8，其中 v0.2.2-v0.2.4 为 CI 三平台迭代）

### 8.3 文档贡献（9 份）

`README.md` / `TEAM_D.md` / `INSTALL_GUIDE.md` / `TEST_DATA.md` / `DEMO_GUIDE.md` / `TEAM_D_WORKLOG.md`（本文） / `.github/workflows/README.md` / 历史快照文档

---

## 终章 · 经验沉淀

### 9.1 协作模式总结

陈岩松（产品负责人）+ AI 协作伙伴（GLM-5.2 / DeepSeek V4 Pro）的分工：

| 陈岩松 | AI 协作伙伴 |
|---|---|
| 决策（发版策略、跳过签名、用 CI/CD） | 调研（拉取代码、分析报错、给方案） |
| 提供素材（生成图标 PNG、列改动清单） | 执行（写代码、跑测试、修 workflow） |
| 验证（亲眼确认 Token 位置不在顶部） | 工程化（写文档、维护 git 历史） |
| 把控方向（不让 AI 跑偏） | 解释概念（IPC / Schema / CI 通俗化） |

### 9.2 关键经验

1. **代理 + GFW 是国内开发的永恒痛点**——用 CI 在境外服务器跑构建，从根上绕开
2. **跨平台 CI 一定有平台特定坑**（签名、脚本、字段），迭代 3-4 轮很正常
3. **小数据走代理 OK，大文件上传会被 reset**——能走 git tag 就别走 release upload
4. **应用更名是破坏性变更**——发新 tag 保留历史比覆盖更负责
5. **文档跟代码同等重要**——v0.2.0 更名后花了一整章同步所有文档引用
6. **AI 协作伙伴擅长调研 + 执行 + 工程化**，但**决策和验证必须人来做**

### 9.3 模型选择

- **GLM-5.2**（智谱）：日常交互主力，对话流畅，中文理解到位
- **DeepSeek V4 Pro**：技术细节、代码生成、长上下文任务
- **GPT-5.5**：图标设计（外部工具）
- **Bun 1.3.14**：claude-mem 插件依赖

---

## 附：版本时间线

```
2026-06-09  v0.2.0  更名 Vibe Reader + Team B/C 集成
2026-06-09          Bun 错误排查修复
2026-06-16  v0.2.1  自定义应用图标
2026-06-17  v0.2.2  CI 三平台首跑（GH_TOKEN 自动发布冲突）
2026-06-17  v0.2.3  CI 补 dist:linux 脚本
2026-06-17  v0.2.4  CI 补 author/email/description（deb 依赖）
2026-06-24  v0.2.5  折叠面板 + 流式 + 内嵌浏览器导航
2026-06-25          演示准备启动
2026-06-26  v0.2.6  作者元数据对齐 + 文档定稿（本文）
2026-06-29  v0.2.7  Reader UI 重构 + 已读/未读/收藏 + Translation 测试（58/58）
2026-06-30  v0.2.8  深度文档审计 + 清理 pptx 二进制（31MB）
```

---

## 附：协作伙伴署名

- **D 组负责人**：陈岩松
- **AI 协作伙伴**：
  - 智谱 GLM-5.2（日常交互主力）
  - DeepSeek V4 Pro（代码生成、技术细节）
- **外部工具**：GPT-5.5（图标设计）、Bun（claude-mem 依赖）

---

**文档版本**：2.0（纪实版）
**最后更新**：2026-06-30
