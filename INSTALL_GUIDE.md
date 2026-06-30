# Vibe Reader 安装与使用指南

## 1. 下载

前往 [GitHub Release 页面](https://github.com/JRXu1028/mercury-vibecoding/releases/latest) 下载对应平台的安装包。

| 平台 | 下载文件 | 架构 |
|------|----------|------|
| macOS | `Vibe.Reader-0.2.8-arm64.dmg` 或 `.zip` | Apple Silicon (M1/M2/M3/M4) |
| Windows | `Vibe.Reader.Setup.0.2.8.exe` | x64 |
| Linux | `Vibe.Reader-0.2.8.AppImage` 或 `vibe-reader_0.2.8_amd64.deb` | x64 |

> Intel Mac 用户：当前仅提供 arm64 版本。如需 Intel 版本，请在 Intel Mac 上 `git clone` 后执行 `npm install && npm run dist`。
>
> 旧版本 v0.1.0（应用名 Mercury Vibecoding）数据存放在 `~/Library/Application Support/mercury-vibecoding/`，与 v0.2.0 起的 Vibe Reader（`~/Library/Application Support/Vibe Reader/`）路径不同，需手动迁移或重新配置订阅源。

---

## 2. 安装

### macOS

**方式一：DMG 安装（推荐）**

1. 双击下载的 `.dmg` 文件
2. 在弹出的窗口中，将 `Vibe Reader` 拖入右侧 `Applications` 文件夹
3. 从启动台或 `Applications` 文件夹中打开应用

**方式二：ZIP 解压**

1. 双击 `.zip` 文件解压
2. 将解压出的 `Vibe Reader.app` 拖入 `Applications` 文件夹
3. 双击打开

**首次打开安全提示**

macOS 可能提示 "无法验证开发者" 或 "无法打开 Vibe Reader，因为无法验证开发者"。这是正常现象，解决方法：

- **方法一**：右键点击应用 → 选择 "打开" → 在弹窗中点击 "打开"
- **方法二**：前往 **系统设置 → 隐私与安全性** → 在底部找到被拦截的应用 → 点击 "仍要打开"

### Windows

1. 双击下载的 `.exe` 安装文件
2. 如果 Windows 弹出 "Windows 已保护你的电脑" 提示，点击 "更多信息" → "仍要运行"
3. 按安装向导提示完成安装
4. 从桌面快捷方式或开始菜单启动

---

## 3. 基本使用

### 3.1 添加 RSS 订阅源

1. 启动应用后，点击左上角的 **+ Add Feed** 按钮
2. 在弹出的输入框中粘贴 RSS 地址，例如：
   - `https://sspai.com/feed`（少数派）
   - `https://www.ruanyifeng.com/blog/atom.xml`（阮一峰）
   - `https://feeds.appinn.com/appinns`（小众软件）
3. 点击 **Add**，应用会自动抓取并显示文章列表

### 3.2 阅读文章

- **左侧栏**：显示所有订阅源，点击切换
- **中间栏**：显示当前订阅源的文章列表，可搜索、可标记已读 / 未读、可收藏
- **右侧栏**：显示选中的文章正文，自动清洗为可读格式
- 内嵌浏览器：点击文章中的外部链接会在应用内打开可缩放浏览窗口，支持前进/后退/刷新

### 3.3 同步

- 点击工具栏的 **Sync** 按钮手动同步当前订阅源
- 应用默认每 10 分钟自动同步所有订阅源
- 可在顶部控制栏调整自动同步间隔或关闭

### 3.4 OPML 导入/导出

- **导入**：点击 **Import OPML** → 选择 `.opml` 文件或粘贴 XML 内容
- **导出**：点击 **Export OPML** → 选择保存位置

---

## 4. AI 功能

### 4.1 Mock 模式（默认，无需配置）

- AI Provider 选择 **Mock** 时，摘要和翻译会返回模拟结果
- 用于测试和体验界面流程，不需要任何 API Key

### 4.2 DeepSeek 模式

**方式一：应用内设置（推荐）**

1. 在应用中选中任意文章，在右侧 AI 工具栏点击齿轮图标 ⚙️
2. 在弹出的 Provider 设置面板中，找到 DeepSeek Provider，点击"设置"
3. 输入你的 DeepSeek API Key，点击"保存"
4. API Key 会通过 Electron safeStorage 加密存储在本地数据库中
5. 将 AI Provider 切换为 **DeepSeek**，即可使用

**方式二：环境变量**

1. 如果应用正在运行，先退出（Cmd+Q）
2. 在终端中设置环境变量并启动应用：
   ```bash
   export DEEPSEEK_API_KEY=sk-your-deepseek-key
   "/Applications/Vibe Reader.app/Contents/MacOS/Vibe Reader" &
   ```
   > 注意：不能使用 `open -a`，因为 macOS GUI 应用不会继承终端环境变量。必须直接启动应用二进制文件。
3. 在应用中将 AI Provider 切换为 **DeepSeek**
4. 点击 **AI Summary** 获取摘要（流式输出，逐字推送），或 **AI Translation** 获取中文翻译

### 4.3 OpenAI-Compatible 模式

**方式一：应用内设置（推荐）**

1. 在应用中选中任意文章，在右侧 AI 工具栏点击齿轮图标 ⚙️
2. 在弹出的 Provider 设置面板中，找到 OpenAI-Compatible Provider，点击"设置"
3. 输入你的 API Key，点击"保存"
4. 将 AI Provider 切换为 **openai-compatible**，即可使用

**方式二：环境变量**

1. 如果应用正在运行，先退出（Cmd+Q）
2. 在终端中设置环境变量并启动应用：
   ```bash
   export OPENAI_COMPATIBLE_API_KEY=sk-your-key
   export OPENAI_COMPATIBLE_BASE_URL=https://your-api-endpoint/v1   # 可选
   export OPENAI_COMPATIBLE_MODEL=gpt-4o-mini                       # 可选
   "/Applications/Vibe Reader.app/Contents/MacOS/Vibe Reader" &
   ```
3. 将 AI Provider 切换为 **openai-compatible**

### 4.4 ECNU 大模型模式

ECNU（华东师范大学）大模型通过 OpenAI-Compatible 协议接入，默认端点 `https://chat.ecnu.edu.cn/open/api/v1`，默认模型 `ecnu-max`。

**方式一：应用内设置（推荐）**

1. 在应用中选中任意文章，在右侧 AI 工具栏点击齿轮图标 ⚙️
2. 在弹出的 Provider 设置面板中，找到 ECNU Provider，点击"设置"
3. 输入你的 ECNU API Key，点击"保存"
4. 将 AI Provider 切换为 **ECNU 大模型**，即可使用

**方式二：环境变量**

```bash
export ECNU_API_KEY=your-ecnu-key
export ECNU_BASE_URL=https://chat.ecnu.edu.cn/open/api/v1   # 可选
export ECNU_MODEL=ecnu-max                                   # 可选
"/Applications/Vibe Reader.app/Contents/MacOS/Vibe Reader" &
```

### 4.5 阅读器工具栏

| 按钮 | 功能 |
|------|------|
| Reader / Markdown | 切换文章显示格式 |
| Light / Sepia / Dark | 切换阅读主题 |
| 字号调节 | 调整正文字体大小 (12-18px) |
| 行高调节 | 调整正文行间距 (1.4-2.2) |

### 4.6 流式摘要

v0.2.0 起支持流式摘要：点击 **AI Summary** 后，摘要内容会以 SSE 方式逐字推送至右侧面板，无需等待完整响应。最近一次 AI 结果会持久化保存，切换文章后仍可回看。

---

## 5. 数据存储位置

| 平台 | 数据库 | 日志 |
|------|--------|------|
| macOS | `~/Library/Application Support/Vibe Reader/mercury-vibecoding.db` | `~/Library/Application Support/Vibe Reader/logs/mercury.log` |
| Windows | `%APPDATA%/Vibe Reader/mercury-vibecoding.db` | `%APPDATA%/Vibe Reader/logs/mercury.log` |
| Linux | `~/.config/Vibe Reader/mercury-vibecoding.db` | `~/.config/Vibe Reader/logs/mercury.log` |

数据独立于应用程序，升级应用不会丢失订阅和文章数据。

---

## 6. 已知问题

| 问题 | 说明 |
|------|------|
| macOS Gatekeeper 拦截 | 应用未签名，首次打开需手动允许（见上方说明） |
| Windows SmartScreen 拦截 | 同上，点击 "仍要运行" 即可 |
| AI 功能仅桌面可用 | HTTP 开发模式下不支持 AI 摘要/翻译 |
| Intel Mac 无预编译包 | 需自行从源码编译打包 |
| v0.1.0 → v0.2.0 数据迁移 | 应用更名导致 userData 目录变更，需手动迁移数据库文件 |

---

## 7. 开发者：从源码构建

**前置要求**：Node.js 22+（项目使用 `node:sqlite` 实验性内置模块，低于 22 无法运行）。

如需从源码构建或修改：

```bash
git clone https://github.com/JRXu1028/mercury-vibecoding.git
cd mercury-vibecoding
npm install
npm --prefix frontend install

# 开发模式
npm run dev:desktop

# 打包
npm run dist        # 当前平台
npm run dist:win    # 仅 Windows
npm run dist:mac    # 仅 macOS
npm run dist:linux  # 仅 Linux

# 运行测试
npm test
```
