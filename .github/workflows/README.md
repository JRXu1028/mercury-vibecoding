# CI/CD 工作流

## 触发条件

| 事件 | 行为 |
|------|------|
| `push` 到 `main` | 仅跑测试（Node 22/24 矩阵） |
| `pull_request` 到 `main` | 仅跑测试 |
| `push tag v*`（如 `v0.3.0`） | 测试 → 构建 macOS/Windows/Linux → 自动发 Release |
| `workflow_dispatch`（手动触发） | 测试 → 构建（不发 Release，artifacts 留 30 天） |

## 发布新版本流程

```bash
# 1. 确保 main 分支干净
git checkout main
git pull

# 2. 改 package.json version
# 例如 0.2.1 → 0.3.0

# 3. 提交并推送
git add package.json
git commit -m "chore: bump version to 0.3.0"
git push

# 4. 打 tag 并推送（触发自动构建 + 发布）
git tag v0.3.0
git push --tags
```

GitHub Actions 跑约 8–12 分钟，三平台产物会自动出现在 [Releases](https://github.com/JRXu1028/mercury-vibecoding/releases)。

## 产物对应

| 平台 | 文件 |
|------|------|
| macOS arm64 | `Vibe.Reader-x.y.z-arm64.dmg` / `.zip` |
| Windows x64 | `Vibe.Reader.Setup.x.y.z.exe` |
| Linux x64 | `Vibe.Reader-x.y.z.AppImage` / `vibe-reader_x.y.z_amd64.deb` |

## 注意事项

- **无代码签名**：macOS 用户首次打开需右键→打开；Windows 用户需点 "仍要运行"
- **artifacts 留 30 天**：手动触发 `workflow_dispatch` 时构建产物仅在 Actions 页保留 30 天
- **测试矩阵**：同时跑 Node 22 和 24，防止 `node:sqlite` 跨版本回归
- **缓存**：通过 `setup-node` 的 `cache: 'npm'` 自动缓存 npm 依赖

## 本地复现 CI 构建

```bash
# 测试
npm test

# macOS
npm run dist:mac

# Windows（需在 Windows 机器上）
npm run dist:win

# Linux
npm run dist:linux
```
