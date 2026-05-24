# 知序 UI/UX 全面重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将知序前端从基础演示版全面升级为符合品牌视觉规范的生产级界面，提升交互友好度和技术质感。

**Architecture:** 基于已有的设计规范（色彩、字体、阴影、间距系统），将内联样式迁移到全局 CSS，引入 SVG 图标系统，重写所有页面组件，添加微交互和过渡动画。

**Tech Stack:** Next.js 16 + React 19 + TypeScript + 纯 CSS（无额外 UI 库）

---

## 文件结构映射

| 文件 | 职责 | 操作 |
|------|------|------|
| `apps/web/app/styles.css` | 全局样式、CSS 变量、组件类 | 大幅扩展 |
| `apps/web/app/icons.tsx` | SVG 图标组件库 | 新建 |
| `apps/web/app/layout.tsx` | 根布局、字体加载 | 修改 |
| `apps/web/app/sidebar.tsx` | 侧边栏导航 | 重写 |
| `apps/web/app/page.tsx` | AI 对话主页 | 重写 |
| `apps/web/app/settings/page.tsx` | 设置页面 | 重写 |
| `apps/web/app/today/page.tsx` | 今日页面 | 重写 |
| `apps/web/app/projects/page.tsx` | 项目列表 | 重写 |
| `apps/web/app/studio/page.tsx` | 产物空间 | 重写 |
| `apps/web/app/knowledge/page.tsx` | 知识空间 | 重写 |
| `apps/web/app/compliance/page.tsx` | 合规页面 | 重写 |
| `apps/web/app/skills/page.tsx` | Skills 页面 | 重写 |
| `apps/web/app/capture/page.tsx` | 捕获页面 | 重写 |
| `apps/web/app/review/page.tsx` | 审核页面 | 重写 |

---

## Phase 1: 基础设施（P0）

### Task 1: 创建 SVG 图标系统

**Files:**
- Create: `apps/web/app/icons.tsx`

- [ ] **Step 1: 定义图标组件接口**

```typescript
export interface IconProps {
  size?: number;
  className?: string;
}
```

- [ ] **Step 2: 创建核心图标组件**

创建以下图标（使用 SVG path，stroke 风格，统一 24x24 viewBox）：
- `IconChat` - 对话气泡
- `IconToday` - 日历/今日
- `IconCapture` - 捕获/导入
- `IconProject` - 项目/文件夹
- `IconStudio` - 产物/画板
- `IconKnowledge` - 知识/书籍
- `IconCompliance` - 合规/盾牌
- `IconSkills` - 技能/闪电
- `IconSettings` - 设置/齿轮
- `IconSend` - 发送/箭头
- `IconUpload` - 上传
- `IconCheck` - 勾选
- `IconSpinner` - 加载旋转
- `IconWarning` - 警告
- `IconInfo` - 信息
- `IconClose` - 关闭
- `IconMenu` - 菜单/汉堡
- `IconChevronRight` - 右箭头
- `IconChevronDown` - 下箭头
- `IconSearch` - 搜索
- `IconPlus` - 加号
- `IconMore` - 更多/三点

每个图标组件：
```tsx
export function IconChat({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
```

- [ ] **Step 3: 验证图标渲染**

在 `apps/web/app/page.tsx` 临时导入并渲染所有图标，确认无报错。

---

### Task 2: 扩展全局样式系统

**Files:**
- Modify: `apps/web/app/styles.css`

- [ ] **Step 1: 添加动画关键帧**

在文件末尾追加：
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: 添加工具类**

```css
.animate-fade-in { animation: fadeIn 0.3s ease both; }
.animate-fade-in-up { animation: fadeInUp 0.4s ease both; }
.animate-fade-in-scale { animation: fadeInScale 0.3s ease both; }
.animate-slide-in-right { animation: slideInRight 0.3s ease both; }
.animate-pulse { animation: pulse 2s ease-in-out infinite; }
.animate-bounce { animation: bounce 1.2s ease-in-out infinite; }
.animate-spin { animation: spin 0.8s linear infinite; }

.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }
.stagger-6 { animation-delay: 0.3s; }

.skeleton {
  background: linear-gradient(90deg, rgba(16,23,34,0.04) 25%, rgba(16,23,34,0.08) 50%, rgba(16,23,34,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
```

- [ ] **Step 3: 添加响应式断点工具类**

```css
@media (max-width: 1024px) {
  .hide-mobile { display: none !important; }
}
@media (min-width: 1025px) {
  .hide-desktop { display: none !important; }
}
```

---

### Task 3: 重写侧边栏组件

**Files:**
- Modify: `apps/web/app/sidebar.tsx`
- Modify: `apps/web/app/styles.css`（添加侧边栏样式）

- [ ] **Step 1: 替换 emoji 为 SVG 图标**

```typescript
import {
  IconChat, IconToday, IconCapture, IconProject,
  IconStudio, IconKnowledge, IconCompliance, IconSkills, IconSettings
} from "./icons";

const NAV_ITEMS = [
  { href: "/", label: "AI 对话", icon: IconChat },
  { href: "/today", label: "今日", icon: IconToday },
  { href: "/capture", label: "捕获", icon: IconCapture },
  { href: "/projects", label: "项目", icon: IconProject },
  { href: "/studio", label: "产物", icon: IconStudio },
  { href: "/knowledge", label: "知识", icon: IconKnowledge },
  { href: "/compliance", label: "合规", icon: IconCompliance },
  { href: "/skills", label: "Skills", icon: IconSkills },
];

const FOOTER_ITEMS = [
  { href: "/settings", label: "设置", icon: IconSettings },
];
```

- [ ] **Step 2: 改进侧边栏视觉**

- 品牌区：加大"知序"字标，添加金色下划线装饰
- 导航项：hover 时背景渐变 + 图标颜色变为金色
- 激活项：左侧金色竖线 + 背景高亮 + 文字金色
- 分组标签：使用大写字母 + 加宽字距
- 底部设置：添加分隔线

- [ ] **Step 3: 添加折叠/展开动画**

移动端侧边栏展开时：
- 遮罩层 fadeIn
- 侧边栏 slideInRight
- 导航项 stagger 动画

---

## Phase 2: 对话页面重构（P0-P1）

### Task 4: 重写对话页面结构

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: 提取样式到 CSS 类**

将内联 `<style>` 中的所有样式提取为 CSS 类名，使用设计 token：

```css
/* 在 styles.css 中添加 */
.conv-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-page);
}

.conv-scroll {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* ... 其他所有对话相关样式 */
```

- [ ] **Step 2: 改进空状态**

空状态设计：
- 大标题："知序，你的 AI 学习科研管家"（使用 font-serif，深墨蓝）
- 副标题："把资料、任务、计划、证据和产物组织成可推进的项目"
- 6 个建议卡片：使用 card 样式，hover 时上浮 + 阴影加深
- 底部提示："输入需求，或选择上方场景开始"

- [ ] **Step 3: 改进用户消息气泡**

- 背景：深墨蓝渐变（135deg, #0D1B2F, #1a2640）
- 圆角：16px 16px 3px 16px（保持）
- 阴影：微妙的蓝色阴影
- 文字：白色，字重 400

- [ ] **Step 4: 改进 AI 消息气泡**

- 背景：纸白 #FBF8F1
- 边框：1px solid rgba(16,23,34,0.06)
- 圆角：4px 14px 14px 14px
- 阴影：card shadow
- 头像：26px 圆角方块，深墨蓝渐变背景，白色"知"字

---

### Task 5: 改进工具调用展示

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/styles.css`

- [ ] **Step 1: 重新设计工具调用卡片**

加载状态：
- 左侧：旋转的蓝色圆环（SVG animation）
- 中间："正在查找项目…"（灰色文字）
- 右侧：脉冲点
- 背景：半透明灰色
- 边框：虚线边框

完成状态：
- 左侧：绿色勾选圆圈（带动画）
- 中间：工具名称（深墨蓝，加粗）
- 右侧：结果预览（等宽字体，截断）
- 背景：淡绿色
- 边框：实线绿色边框

- [ ] **Step 2: 添加工具调用展开/收起**

点击工具调用卡片可展开查看完整结果：
- 展开高度动画（max-height transition）
- 结果区域使用等宽字体 + 滚动条
- 添加"复制结果"按钮

---

### Task 6: 改进输入框

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/styles.css`

- [ ] **Step 1: 重新设计输入框容器**

- 背景：白色
- 边框：1px solid rgba(16,23,34,0.08)
- 圆角：16px
- 阴影：0 2px 12px rgba(0,0,0,0.04)
- 聚焦：边框变深墨蓝 + 外发光 0 0 0 3px rgba(13,27,47,0.08)

- [ ] **Step 2: 改进发送按钮**

- 默认状态：灰色背景，不可点击
- 可发送状态：深墨蓝背景，白色箭头
- hover：scale(1.05) + 阴影加深
- active：scale(0.95)
- 发送中：旋转动画

- [ ] **Step 3: 添加快捷操作栏**

输入框上方添加快捷操作：
- 上传文件按钮（IconUpload）
- 语音输入按钮（隐藏，预留）
- 当前模式标签（如"PPT 模式"、"论文模式"）

---

### Task 7: 改进 Markdown 渲染

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: 改进表格样式**

```css
.md-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 12px 0;
  font-size: 0.82rem;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
}
.md-th {
  text-align: left;
  padding: 10px 14px;
  background: rgba(13,27,47,0.04);
  font-weight: 600;
  color: var(--color-text-title);
  border-bottom: 2px solid var(--color-border-subtle);
  white-space: nowrap;
}
.md-td {
  padding: 8px 14px;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-body);
}
.md-tr:last-child .md-td {
  border-bottom: none;
}
.md-tr:hover .md-td {
  background: rgba(13,27,47,0.02);
}
```

- [ ] **Step 2: 改进代码块样式**

- 背景：深墨蓝 #0D1B2F
- 文字：浅灰色
- 圆角：8px
- 内边距：12px 16px
- 字体：等宽字体
- 添加复制按钮（hover 显示）

- [ ] **Step 3: 改进引用块样式**

- 左侧：4px 金色竖线
- 背景：淡金色 rgba(184,155,94,0.06)
- 内边距：8px 16px
- 文字：斜体

---

## Phase 3: 其他页面重构（P1-P2）

### Task 8: 重写今日页面

**Files:**
- Modify: `apps/web/app/today/page.tsx`

- [ ] **Step 1: 设计 Agent Brief 区域**

顶部卡片展示 AI 当前状态：
- 左侧：AI 头像 + 状态指示器（绿色圆点）
- 中间：AI 正在处理的任务摘要
- 右侧：时间戳

- [ ] **Step 2: 设计待确认区域**

横向滚动卡片列表：
- 每个卡片：任务类型图标 + 标题 + 截止时间 + 操作按钮
- 卡片样式：choice-card

- [ ] **Step 3: 设计 AI 后台任务区域**

列表展示后台进行中的任务：
- 进度条（动画）
- 任务名称
- 预计完成时间

---

### Task 9: 重写项目页面

**Files:**
- Modify: `apps/web/app/projects/page.tsx`
- Modify: `apps/web/app/studio/page.tsx`

- [ ] **Step 1: 设计项目卡片**

每个项目卡片包含：
- 项目类型图标（PPT、论文、实验等）
- 项目名称
- 当前状态标签（彩色）
- 进度条
- 截止时间
- 最近活动

- [ ] **Step 2: 添加空状态**

无项目时显示：
- 插图（使用 Lucide 图标组合）
- "还没有项目"
- "创建第一个项目"按钮

---

### Task 10: 重写设置页面

**Files:**
- Modify: `apps/web/app/settings/page.tsx`

- [ ] **Step 1: 改进设置卡片布局**

- 左侧：设置分类导航（固定）
- 右侧：设置内容区
- 卡片样式：使用 card 类

- [ ] **Step 2: 改进 LLM 配置面板**

- 状态指示器：连接成功（绿色圆点 + 文字）
- 输入框：聚焦动画 + 图标前缀
- 按钮：主按钮（深墨蓝）+ 次按钮（边框）
- 预设按钮：hover 效果

---

### Task 11: 添加加载状态和骨架屏

**Files:**
- Modify: `apps/web/app/styles.css`
- Modify: 各页面文件

- [ ] **Step 1: 创建骨架屏组件**

```tsx
function Skeleton({ width, height, className = "" }: { width?: string; height?: string; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ width, height }} />;
}
```

- [ ] **Step 2: 在对话页面添加加载骨架**

AI 回复加载时显示：
- 头像骨架（圆形）
- 内容骨架（多行）
- 带动画 shimmer

- [ ] **Step 3: 改进打字指示器**

三个圆点改为：
- 更流畅的弹跳动画
- 颜色渐变（深墨蓝 → 灰色）

---

### Task 12: 响应式适配

**Files:**
- Modify: `apps/web/app/styles.css`
- Modify: `apps/web/app/sidebar.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: 移动端侧边栏**

- 默认隐藏
- 汉堡菜单按钮触发
- 全屏遮罩 + 侧边栏滑入

- [ ] **Step 2: 移动端对话页面**

- 输入框固定在底部
- 消息全宽
- 建议卡片 2 列

- [ ] **Step 3: 平板适配**

- 侧边栏可折叠为图标模式
- 内容区自适应

---

## Phase 4: 微交互和动画

### Task 13: 添加页面过渡动画

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: 添加页面切换动画**

使用 CSS 实现简单的页面淡入：
```css
.page-transition-enter {
  opacity: 0;
  transform: translateY(8px);
}
.page-transition-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
```

---

### Task 14: 添加 Hover 和 Focus 效果

**Files:**
- Modify: `apps/web/app/styles.css`

- [ ] **Step 1: 统一按钮交互**

所有按钮：
- hover：translateY(-1px) + 阴影加深
- active：translateY(0) + scale(0.98)
- focus：outline 2px solid 金色 + outline-offset 2px

- [ ] **Step 2: 统一卡片交互**

所有卡片：
- hover：translateY(-2px) + 阴影加深
- 过渡：0.2s ease

- [ ] **Step 3: 统一链接交互**

所有链接：
- hover：颜色变为金色
- 下划线动画（从左到右展开）

---

## 测试清单

每完成一个 Task，验证：
- [ ] 页面无报错
- [ ] 样式正确应用
- [ ] 动画流畅（60fps）
- [ ] 响应式正常
- [ ] 无障碍（键盘导航、对比度）

---

## 执行顺序

1. Task 1: 图标系统
2. Task 2: 全局样式扩展
3. Task 3: 侧边栏重写
4. Task 4: 对话页面结构
5. Task 5: 工具调用展示
6. Task 6: 输入框改进
7. Task 7: Markdown 渲染
8. Task 11: 加载状态（提前，对话页面需要）
9. Task 8: 今日页面
10. Task 9: 项目页面
11. Task 10: 设置页面
12. Task 12: 响应式
13. Task 13: 页面过渡
14. Task 14: Hover/Focus 效果
