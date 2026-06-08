# Mercury Vibecoding — 演示测试数据

## 测试 RSS 源（10 个）

| # | 名称 | RSS 地址 | 类型 |
|---|------|----------|------|
| 1 | 少数派 | `https://sspai.com/feed` | 科技/效率 |
| 2 | 阮一峰博客 | `https://www.ruanyifeng.com/blog/atom.xml` | 技术/科技 |
| 3 | 小众软件 | `https://feeds.appinn.com/appinns` | 软件/工具 |
| 4 | 36氪 | `https://36kr.com/feed` | 科技/商业 |
| 5 | 知乎热榜 | `https://rsshub.app/zhihu/hotlist` | 综合 |
| 6 | V2EX | `https://www.v2ex.com/index.xml` | 技术/社区 |
| 7 | 美团技术团队 | `https://tech.meituan.com/feed/` | 技术 |
| 8 | 极客公园 | `https://www.geekpark.net/rss` | 科技 |
| 9 | Hacker News | `https://hnrss.org/frontpage` | 技术（英文） |
| 10 | The Verge | `https://www.theverge.com/rss/index.xml` | 科技（英文） |

## LLM Provider 测试配置

### 方案一：Mock Provider（无需配置）

直接使用 Mock Provider，返回模拟结果，适合演示 UI 流程。

### 方案二：DeepSeek

1. 获取 API Key：https://platform.deepseek.com/
2. 在应用内 Provider 设置面板输入 Key，或通过环境变量：
   ```bash
   export DEEPSEEK_API_KEY=sk-your-key
   ```
3. 模型：`deepseek-v4-flash`

### 方案三：OpenAI-Compatible

适用于任何兼容 `/chat/completions` 接口的服务（如 ModelBest、OpenRouter、OpenAI）：

```bash
export OPENAI_COMPATIBLE_API_KEY=sk-your-key
export OPENAI_COMPATIBLE_BASE_URL=https://your-endpoint/v1
export OPENAI_COMPATIBLE_MODEL=gpt-4o-mini
```

## 演示流程

1. 启动应用，通过 `+ Add Feed` 依次添加 2-3 个 RSS 源
2. 点击 `Sync` 同步文章
3. 点击一篇文章，展示清洗后的阅读视图
4. 切换 Reader/Markdown、Light/Sepia/Dark 主题
5. 使用 AI Summary 生成摘要（先用 Mock，再切 DeepSeek 演示真实效果）
6. 使用 AI Translation 生成中文翻译
7. 点击齿轮图标，展示 Provider 管理面板
8. 展示标签功能：给文章添加标签、创建新标签
9. 展示笔记功能：添加阅读笔记
