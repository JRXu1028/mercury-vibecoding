import fs from 'node:fs/promises';
import path from 'node:path';

const artifactToolPath = '/Users/a/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/@oai+artifact-tool@file+local-deps+-oai-artifact-tool-oai-artifact_tool-2.8.0.tgz/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const { Presentation, PresentationFile } = await import(artifactToolPath);

const WIDTH = 1280;
const HEIGHT = 720;
const TRANSPARENT = '#00000000';

const theme = {
  titleBar: '#0B3A66',
  titleText: '#FFFFFF',
  heading: '#0B3A66',
  body: '#1F2937',
  subtle: '#6B7280',
  panel: '#F5F7FA',
  placeholderBg: '#F8FAFC',
  placeholderBorder: '#9CA3AF',
};

function addShape(slide, { x, y, width, height, geometry = 'rect', fill = TRANSPARENT, line = { style: 'solid', fill: TRANSPARENT, width: 0 } }) {
  return slide.shapes.add({
    geometry,
    position: { x, y, width, height },
    fill,
    line,
  });
}

function addText(slide, { x, y, width, height, text, size = 24, color = theme.body, bold = false, align = 'left', valign = 'top', face = 'PingFang SC' }) {
  const box = addShape(slide, { x, y, width, height });
  box.text = text;
  box.text.fontSize = size;
  box.text.color = color;
  box.text.bold = bold;
  box.text.typeface = face;
  box.text.alignment = align;
  box.text.verticalAlignment = valign;
  box.text.insets = { left: 4, right: 4, top: 4, bottom: 4 };
  return box;
}

function addTitle(slide, title) {
  addShape(slide, {
    x: 0,
    y: 0,
    width: WIDTH,
    height: 84,
    fill: theme.titleBar,
  });
  addText(slide, {
    x: 36,
    y: 16,
    width: WIDTH - 72,
    height: 52,
    text: title,
    size: 34,
    color: theme.titleText,
    bold: true,
    valign: 'middle',
  });
}

function addSectionLabel(slide, label) {
  addShape(slide, {
    x: 90,
    y: 102,
    width: 460,
    height: 44,
    fill: theme.panel,
  });
  addText(slide, {
    x: 102,
    y: 110,
    width: 436,
    height: 28,
    text: label,
    size: 20,
    color: theme.heading,
    valign: 'middle',
  });
}

function bullet(items) {
  return items.map((s) => `• ${s}`).join('\n');
}

function addPlaceholder(slide, { x, y, width, height }) {
  addShape(slide, {
    x,
    y,
    width,
    height,
    fill: theme.placeholderBg,
    line: { style: 'solid', fill: theme.placeholderBorder, width: 2 },
  });
  addText(slide, {
    x: x + 20,
    y: y + height / 2 - 44,
    width: width - 40,
    height: 88,
    text: '图片占位符\n（后续替换为实际截图）',
    size: 24,
    color: theme.subtle,
    align: 'center',
    valign: 'middle',
  });
}

const pres = Presentation.create({ slideSize: { width: WIDTH, height: HEIGHT } });

// 1. Title page
{
  const s = pres.slides.add();
  addTitle(s, 'Mercury Vibecoding');
  addText(s, {
    x: 120,
    y: 180,
    width: 1040,
    height: 110,
    text: '第二周进展汇报（Team A）',
    size: 52,
    color: theme.heading,
    bold: true,
    align: 'center',
    valign: 'middle',
  });
  addText(s, {
    x: 120,
    y: 350,
    width: 1040,
    height: 180,
    text: 'Team A：Feed & 同步组\n课程小组项目\n2026-05-28',
    size: 30,
    color: theme.body,
    align: 'center',
    valign: 'middle',
  });
}

// 2. Agenda
{
  const s = pres.slides.add();
  addTitle(s, '汇报提纲');
  addText(s, {
    x: 170,
    y: 220,
    width: 940,
    height: 360,
    text: bullet(['本周目标与完成情况', '实现细节', '质量与风险', '下周计划']),
    size: 38,
    color: theme.body,
    valign: 'top',
  });
}

// 3. Goals
{
  const s = pres.slides.add();
  addTitle(s, '本周目标（对齐 Team A 职责）');
  addSectionLabel(s, '本周目标与完成情况');
  addText(s, {
    x: 120,
    y: 170,
    width: 1040,
    height: 440,
    text: bullet([
      '完成 Feed 添加/删除与 RSS/Atom 解析',
      '完成 OPML 导入/导出',
      '完成 Feed 同步（单源、全量、定时）',
      '打通文章列表展示闭环',
      '从本地网页联调升级为 Electron 桌面应用',
    ]),
    size: 29,
    color: theme.body,
  });
}

// 4. Delivery
{
  const s = pres.slides.add();
  addTitle(s, '本周交付结果（已完成）');
  addSectionLabel(s, '本周目标与完成情况');
  addText(s, {
    x: 100,
    y: 160,
    width: 1080,
    height: 500,
    text: bullet([
      '数据层：落地 `feeds` / `entries` 表，支持去重写入（`feed_id + guid`）',
      '解析层：接入 `rss-parser`（RSS/Atom）和 `fast-xml-parser`（OPML）',
      '服务层：`FeedService`、`OPMLService`、同步流程与错误处理',
      '前端层：三栏 UI（订阅源 / 文章列表 / 详情）+ 搜索 + 导入导出交互',
      '桌面化：`Electron Main + Preload + IPC`，前端 API 改为 IPC 优先',
    ]),
    size: 24,
    color: theme.body,
  });
}

// 5. Architecture
{
  const s = pres.slides.add();
  addTitle(s, '技术架构（当前可演示版本）');
  addSectionLabel(s, '实现细节');
  addText(s, {
    x: 340,
    y: 160,
    width: 600,
    height: 360,
    text: '用户操作\n↓\nRenderer（Vue 3 + TypeScript）\n↓ IPC\nMain Process（Electron + Node.js）\n↓\nFeed/OPML Service\n↓\nSQLite（本地数据）',
    size: 27,
    color: theme.body,
    align: 'center',
  });
  addText(s, {
    x: 180,
    y: 540,
    width: 940,
    height: 120,
    text: bullet(['本地优先：无登录、无云端依赖', '跨平台基础：桌面壳已切换为 Electron']),
    size: 24,
    color: theme.body,
  });
}

// 6. Key demos + placeholder
{
  const s = pres.slides.add();
  addTitle(s, '关键功能演示点');
  addSectionLabel(s, '实现细节');
  addText(s, {
    x: 90,
    y: 170,
    width: 620,
    height: 430,
    text: bullet([
      '输入 RSS URL，添加 Feed',
      '展示文章列表并可搜索',
      '单源同步/全量同步',
      'OPML 导入（文件/粘贴）',
      'OPML 导出（桌面保存）',
    ]),
    size: 25,
    color: theme.body,
  });
  addPlaceholder(s, { x: 760, y: 190, width: 430, height: 340 });
}

// 7. UI + large placeholder
{
  const s = pres.slides.add();
  addTitle(s, '界面与交互（桌面版）');
  addSectionLabel(s, '实现细节');
  addPlaceholder(s, { x: 150, y: 160, width: 980, height: 370 });
  addText(s, {
    x: 160,
    y: 560,
    width: 960,
    height: 90,
    text: bullet(['建议替换为：主界面三栏截图（含 Feed、Entry、Detail）']),
    size: 24,
    color: theme.body,
  });
}

// 8. Validation and risks
{
  const s = pres.slides.add();
  addTitle(s, '验证结果与当前风险');
  addSectionLabel(s, '质量与风险');
  addText(s, {
    x: 100,
    y: 160,
    width: 500,
    height: 430,
    text: '已验证：\n• 后端构建通过，单元测试通过（Feed/Sync/OPML）\n• 前端构建通过，桌面应用可启动',
    size: 24,
    color: theme.body,
  });
  addText(s, {
    x: 650,
    y: 160,
    width: 540,
    height: 430,
    text: '风险与待优化：\n• 部分中文站点 Feed 源稳定性一般（限流/SSL 兼容）\n• 前端打包体积偏大（后续可做分包）\n• 需补充跨平台实机验证（Windows/Linux）',
    size: 24,
    color: theme.body,
  });
}

// 9. Next week
{
  const s = pres.slides.add();
  addTitle(s, '下周计划（Team A）');
  addSectionLabel(s, '下周计划');
  addText(s, {
    x: 120,
    y: 190,
    width: 1030,
    height: 420,
    text: bullet([
      '完善订阅源异常处理与重试策略',
      '增加更多 Feed 测试样例与导入容错用例',
      '协助 Team D 对接打包流程（electron-builder）',
      '与 Team B/C 联调接口，确保后续功能接入顺畅',
    ]),
    size: 30,
    color: theme.body,
  });
}

// 10. Q&A
{
  const s = pres.slides.add();
  addTitle(s, 'Q & A');
  addText(s, {
    x: 280,
    y: 280,
    width: 720,
    height: 160,
    text: '谢谢大家',
    size: 66,
    color: theme.heading,
    bold: true,
    align: 'center',
    valign: 'middle',
  });
}

const outPath = '/Users/a/Documents/Program/mercury/mercury-vibecoding/overleaf-weekly-report/Mercury_第二周进展汇报_TeamA.pptx';
await fs.mkdir(path.dirname(outPath), { recursive: true });
const pptx = await PresentationFile.exportPptx(pres);
await pptx.save(outPath);
console.log(outPath);
