# 知序 UI/UX 全面重构设计文档

## 1. 设计目标

将知序从「基础演示版」升级为「高端技术产品」，核心目标：

1. **技术触感极致表达**：工具调用、Agent 处理必须有电影级前端展示
2. **品牌调性深度落地**：深墨蓝 + 克制金 + 纸白，营造学术高端感
3. **交互体验丝滑流畅**：每个操作都有精心设计的反馈和动效
4. **信息层次清晰分明**：通过视觉权重引导用户注意力

## 2. 设计方向：混合增强版

融合「精致学术风」与「科技管家风」：
- **基础调性**：克制、留白、低噪音（学术风）
- **技术表达**：动态数据流、实时状态指示、进度可视化（科技风）
- **动效策略**：微妙但精致，不喧宾夺主

## 3. 色彩系统升级

```css
/* 主色 */
--color-ink-blue: #0D1B2F;         /* 深墨蓝 - 主按钮、导航、标题 */
--color-ink-blue-hover: #1a2d4a;    /* 深墨蓝悬停 */
--color-ink-blue-light: rgba(13, 27, 47, 0.08); /* 浅墨蓝背景 */

/* 辅助色 */
--color-gold: #B89B5E;              /* 克制金 - 强调、分隔、高亮 */
--color-gold-light: rgba(184, 155, 94, 0.12); /* 浅金背景 */
--color-gold-glow: rgba(184, 155, 94, 0.25);  /* 金色光晕 */

/* 背景色 */
--color-bg-body: #F8F7F2;           /* 纸白 - 页面背景 */
--color-bg-card: #FFFFFF;           /* 纯白 - 卡片背景 */
--color-bg-float: rgba(255, 255, 255, 0.85); /* 浮层背景 */
--color-bg-sidebar: #FAFAF7;        /* 侧边栏背景 */
--color-bg-dark-workspace: #0D1B2F; /* 深色工作区 */

/* 文字色 */
--color-text-title: #0D1B2F;        /* 标题文字 */
--color-text-body: #1e293b;         /* 正文文字 */
--color-text-secondary: #475569;    /* 次要文字 */
--color-text-hint: #94a3b8;         /* 提示文字 */

/* 功能色 */
--color-evidence-green: #1B8A5A;    /* 证据绿 */
--color-verification-yellow: #D89614; /* 核验黄 */
--color-risk-red: #B65B5B;          /* 风险红 */
--color-reference-gray: #98A2B3;    /* 参考灰 */

/* 边框 */
--color-border-subtle: rgba(13, 27, 47, 0.08); /* 微妙边框 */
--color-border-card: rgba(13, 27, 47, 0.1);    /* 卡片边框 */
```

## 4. 字体系统

```css
--font-serif: "Noto Serif SC", "Source Han Serif SC", Georgia, serif; /* 标题衬线 */
--font-sans: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif; /* 正文 */
--font-mono: "JetBrains Mono", "Fira Code", monospace; /* 代码 */

/* 字号层级 */
--fs-display: 2.5rem;      /* 展示标题 */
--fs-h1: 1.75rem;          /* 一级标题 */
--fs-h2: 1.4rem;           /* 二级标题 */
--fs-h3: 1.15rem;          /* 三级标题 */
--fs-body: 15px;           /* 正文 */
--fs-body-sm: 13px;        /* 小正文 */
--fs-label: 12px;          /* 标签 */
--fs-caption: 11px;        /* 注释 */

/* 行高 */
--lh-reading: 1.75;        /* 阅读行高 */
--lh-ui: 1.5;              /* UI行高 */
```

## 5. 动画系统

```css
/* 缓动函数 */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-in-out-sine: cubic-bezier(0.37, 0, 0.63, 1);

/* 持续时间 */
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 400ms;
--duration-slower: 600ms;

/* 过渡 */
--transition-fast: all var(--duration-fast) var(--ease-out-expo);
--transition-base: all var(--duration-base) var(--ease-out-expo);
--transition-slow: all var(--duration-slow) var(--ease-out-expo);
```

### 关键动画效果

1. **消息渐入**：`message-appear` - 从下方滑入 + 缩放
2. **头像弹出**：`avatar-pop` - 弹性缩放
3. **工具调用展开**：`tool-call-expand` - 高度展开 + 透明度
4. **脉冲光环**：`pulse-ring` - 扩散消失的光环
5. **呼吸浮动**：`float` - 上下轻微浮动
6. **骨架屏闪光**：`shimmer` - 渐变扫过
7. **边框发光**：`border-glow` - 金色光晕脉冲

## 6. 组件升级规范

### 6.1 侧边栏导航

- **Logo区**：渐变背景 + 品牌字标，hover有微妙光晕
- **导航项**：左侧增加3px圆角竖线指示器（激活时金色）
- **Hover效果**：背景色渐变 + 文字色变化，过渡150ms
- **分组标签**：大写字母间距，灰色小字
- **折叠动画**：宽度变化 + 内容淡入淡出

### 6.2 AI对话页

#### 空状态
- Logo：渐变背景 + 浮动动画
- 标题：渐入动画，字间距优化
- 建议卡片：网格布局，hover时上浮 + 金色边框 + 阴影增强
- 卡片图标：金色背景圆角方块

#### 消息气泡
- **用户消息**：深墨蓝背景，右上角圆角变尖，hover无效果
- **AI消息**：白色背景 + 微妙边框，左上角圆角变尖
- **头像**：AI头像渐变背景 + 弹性出现动画
- **思考中**：三个点的波浪动画，金色脉冲

#### 工具调用展示（重点）

**设计目标**：让每个工具调用都像「AI在施展能力」

- **加载状态**：
  - 卡片边框金色脉冲动画
  - 左侧图标区域旋转加载器
  - 文字显示「正在思考…」带闪烁光标
  - 背景 subtle 金色渐变流动

- **完成状态**：
  - 卡片边框变绿色
  - 左侧图标变成对勾，弹性出现
  - 文字显示工具名 + 结果摘要
  - 延迟依次出现（错开80ms）

- **视觉层次**：
  - 多个工具调用形成垂直堆叠
  - 每个卡片有微妙的左侧边框色指示状态
  - 卡片间有8px间距

#### 输入区域
- **容器**：圆角大输入框，聚焦时金色边框 + 光晕阴影
- **发送按钮**：深墨蓝背景，hover缩放1.05 + 背景变亮
- **Placeholder**：灰色斜体
- **Hint文字**：更小的灰色文字，居中

### 6.3 今日概览页

#### 简报卡片
- **左侧**：eyebrow文字（大写灰色）+ 主文案
- **右侧**：4个统计数字，大字号 + 标签小字
- **背景**：白色卡片 + 微妙阴影

#### 三列布局
- **待确认**：黄色圆点指示 + 卡片列表
- **AI处理中**：蓝色圆点 + 进度条动画
- **今天要做**：绿色圆点 + 复选框

#### 进度条
- **轨道**：浅灰背景，圆角
- **填充**：渐变色彩（根据状态变化）
- **动画**：宽度从0到目标值的平滑过渡

### 6.4 项目列表页

#### 项目卡片
- **顶部**：类型标签 + 风险徽章
- **标题**：深墨蓝，1.15rem
- **下一步**：灰色小字
- **底部**：状态标签 + 截止日期
- **Hover效果**：
  - 卡片上移2px
  - 阴影增强
  - 边框变金色
  - 过渡250ms

#### 空状态
- 插画 + 文案 + 创建按钮

### 6.5 设置页

#### 导航侧边栏
- 图标 + 文字
- 激活项：金色左侧边框 + 浅金背景

#### 表单元素
- **输入框**：聚焦时金色边框 + 微妙光晕
- **开关**：滑动动画，绿色激活
- **单选卡片**：选中时金色边框 + 背景变化
- **按钮**：
  - Primary：深墨蓝背景，hover变亮
  - Secondary：白色背景 + 边框，hover灰色背景
  - Danger：红色背景，hover加深

## 7. 技术实现要点

### 7.1 CSS架构
- 使用CSS变量定义所有设计令牌
- 动画优先使用CSS keyframes（GPU加速）
- 过渡使用transform和opacity（避免重排）

### 7.2 性能优化
- 动画元素添加`will-change: transform, opacity`
- 使用`transform`代替`top/left`位移
- 复杂动画使用`requestAnimationFrame`

### 7.3 响应式
- 移动端侧边栏变为抽屉式
- 今日概览三列变为单列堆叠
- 项目卡片网格变为单列

## 8. 文件变更清单

### 核心样式
- `apps/web/app/styles.css` - 全面重构

### 组件升级
- `apps/web/app/sidebar.tsx` - 导航动效
- `apps/web/app/page.tsx` - AI对话页
- `apps/web/app/today/page.tsx` - 今日概览
- `apps/web/app/projects/page.tsx` - 项目列表
- `apps/web/app/settings/page.tsx` - 设置页

### 新增组件
- `apps/web/app/components/ToolCallVisualizer.tsx` - 工具调用可视化
- `apps/web/app/components/AnimatedCounter.tsx` - 数字动画
- `apps/web/app/components/ProgressBar.tsx` - 进度条
- `apps/web/app/components/SkeletonLoader.tsx` - 骨架屏

## 9. 验收标准

- [ ] 所有页面加载时有渐入动画
- [ ] 工具调用展示有完整的加载→完成动画流程
- [ ] 消息发送有流畅的输入→发送→AI回复流程
- [ ] 侧边栏导航有清晰的激活状态指示
- [ ] 所有hover状态有微妙的过渡效果
- [ ] 今日概览的数据卡片有视觉层次
- [ ] 项目卡片hover有上浮效果
- [ ] 设置页表单有聚焦反馈
- [ ] 整体色彩符合品牌规范
- [ ] 字体层次清晰可读
