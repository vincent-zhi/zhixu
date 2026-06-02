# Agent Canvas Workspace — 课程 PPT 与组会论文汇报 功能设计

## 1. 设计目标

将知序从"多功能工具集合"升级为"AI Agent 驱动的任务工作台"：

- **AI 对话是主入口**：用户说目标，Agent 推进任务
- **Canvas 是成果空间**：对话过程中实时生成 PPT 大纲、论文矩阵、讲稿、证据链
- **A/B/C 决策卡是关键交互**：Agent 只在关键选择点打断用户
- **现有模块全部复用**：Project / Source / Evidence / Artifact / HumanGate / Skills 不废弃，作为 Agent 工具层
- **Agent 过程可见**：前端显式展示 Agent 的具体工作与协作过程，让技术被用户真实感知

保留的独立页面：资料库 `/materials`、项目 `/projects`、技能 `/skills`、日程 `/schedule`、知识 `/knowledge`、捕获 `/capture`、今日 `/today`、设置 `/settings`。

> 合规模块（`compliance`）暂不作为核心功能，降级为第三阶段扩展。

---

## 2. 产品架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Canvas Workspace                       │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Conversation Layer  │  │        Canvas Layer              │ │
│  │                      │  │                                   │ │
│  │  用户输入目标         │  │  任务理解卡                       │ │
│  │  上传资料            │  │  资料解析进度                      │ │
│  │  AI 提问澄清         │  │  Paper Cards / 对比矩阵           │ │
│  │  A/B/C 方案选择      │  │  PPT 页级大纲                     │ │
│  │  进度汇报            │  │  每页讲稿                         │ │
│  │  关键节点确认        │  │  证据来源 / 风险提示               │ │
│  │                      │  │  导出状态                         │ │
│  └──────────┬───────────┘  └──────────────┬───────────────────┘ │
│             │                             │                     │
│             └──────────┬──────────────────┘                     │
│                        │                                        │
│             ┌──────────▼──────────┐                              │
│             │  Agent Tool Layer   │                              │
│             │                     │                              │
│             │  DocumentPipeline   │  解析资料                    │
│             │  research           │  论文精读                    │
│             │  paper-reading      │  Paper Card + 对比矩阵       │
│             │  ppt-cocreation     │  选题 / 大纲 / 讲稿          │
│             │  artifact-factory   │  导出 PPTX/DOCX/PDF         │
│             │  compliance         │  引用 / 证据 / 风险检查（第三阶段）│
│             │  skill-runtime      │  调用 Skills                 │
│             │  HumanGate          │  关键确认                    │
│             │  quota              │  成本控制                    │
│             │  coaching           │  汇报教练 / 答辩模拟          │
│             │  mentor-feedback    │  导师反馈处理                 │
│             │  undergrad          │  本科场景增强                 │
│             │  grad               │  研究生场景增强               │
│             │  exam / exam-prep   │  备考场景                    │
│             │  version            │  版本沉淀                    │
│             │  offline            │  本地优先                    │
│             └─────────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心界面设计

### 3.1 主页面改造 (`apps/web/app/page.tsx`)

现有 `page.tsx` 是纯对话界面。改造为三栏布局：

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: 知序 · 3 个 Agent 正在协作 · 本地优先 · 新对话         │
├──────────────────┬──────────────────┬───────────────────────────┤
│                  │  Agent Process   │                           │
│  Conversation    │  Panel           │     Canvas Layer          │
│  Layer           │  (可折叠)        │                           │
│  (35% width)     │  (15% width)     │     (50% width)           │
│                  │                  │                           │
│  用户: 下周三组会 │  ┌────────────┐  │   ┌─ 任务理解卡 ──────┐  │
│  读这5篇论文做PPT│  │ 🔍 Source   │  │   │ 汇报类型: 组会     │  │
│                  │  │ Parsing     │  │   │ 截止: 下周三       │  │
│  知序: [任务卡]  │  │ Agent       │  │   │ 时长: 15分钟       │  │
│  我理解你的任务..│  │ ✅ 2/5 完成 │  │   │ 产物: PPT+讲稿     │  │
│                  │  ├────────────┤  │   └────────────────────┘  │
│  [A/B/C 决策卡]  │  │ 📊 Paper    │  │                           │
│  A. 主论文精讲   │  │ Reading     │  │   ┌─ Paper Cards ─────┐  │
│  B. 多论文对比 ★ │  │ Agent       │  │   │ Paper 1: Attn...  │  │
│  C. 研究脉络型   │  │ 🔄 生成中   │  │   │ Paper 2: BERT...  │  │
│                  │  ├────────────┤  │   └────────────────────┘  │
│  用户: 选B       │  │ 🎨 Present- │  │                           │
│                  │  │ ation Agent │  │   ┌─ 对比矩阵 ────────┐  │
│  知序: 正在生成..│  │ ⏳ 等待中   │  │   │ Paper|Method|Data │  │
│                  │  └────────────┘  │   └────────────────────┘  │
│                  │                  │                           │
│                  │  [协作流图]       │   ┌─ PPT 大纲 ────────┐  │
│                  │  Task→Parse→     │   │ 1. 研究背景        │  │
│                  │  Read→Plan→      │   │ 2. 方法对比        │  │
│                  │  Present→Export  │   │ 3. 实验结果        │  │
│                  │                  │   └────────────────────┘  │
├──────────────────┴──────────────────┴───────────────────────────┤
│  输入框: 描述任务、粘贴要求，或让知序继续推进当前项目...  [发送]  │
│  重要内容会进入可追溯流程，高风险操作会先请求确认。               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Canvas 三栏模式（点击大纲某页时展开）

当用户在 Canvas 中点击某页/某个结论时，Canvas 切换为三栏：

```
┌──────────────┬──────────────────────┬──────────────────────┐
│  页级大纲     │  当前页内容编辑       │  Agent Inspector     │
│              │                      │                      │
│  1. 标题页 ✓ │  标题: 方法对比       │  📎 来源             │
│  2. 背景 ✓  │                      │  - Paper1 p.3        │
│  3. 方法 ←  │  要点:               │  - Paper2 p.5        │
│  4. 实验     │  • Transformer...    │                      │
│  5. 结果     │  • BERT 改进...      │  ⚠️ AI推断内容       │
│  6. 局限     │                      │  - "更适合序列建模"   │
│  7. 计划     │  讲稿:              │                      │
│              │  这一页重点讲...      │  🎤 讲稿时长: 2分30秒│
│              │                      │                      │
│              │                      │  🔄 让AI重写这一页   │
│              │                      │  风格: 更学术/口语/简洁│
└──────────────┴──────────────────────┴──────────────────────┘
```

### 3.3 A/B/C 决策卡设计

决策卡是知序的标志性交互，在对话流中渲染为可点击卡片：

```
┌─ 选择汇报方向 ──────────────────────────────────────────┐
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────┐ │
│  │ A. 主论文精讲型   │  │ B. 多论文对比型 ★ │  │ C. 研  │ │
│  │                  │  │                  │  │ 究脉络  │ │
│  │ 适合有一篇核心    │  │ 适合组会讨论     │  │ 型      │ │
│  │ 论文，讲得深入    │  │ 突出方法、实验、 │  │        │ │
│  │                  │  │ 局限对比         │  │ 适合开  │ │
│  │ 深度高，覆盖面少  │  │                  │  │ 题/综述 │ │
│  │                  │  │ 预计投入: 30分钟  │  │        │ │
│  │ 预计投入: 40分钟  │  │ 风险: L1         │  │ 预计投  │ │
│  │ 风险: L1         │  │ 推荐             │  │ 入: 50  │ │
│  └──────────────────┘  └──────────────────┘  │ 分钟    │ │
│                                               │ 风险:   │ │
│                                               │ L2      │ │
│                                               └────────┘ │
└──────────────────────────────────────────────────────────┘
```

每张卡的字段：
- `id`: 选项标识
- `title`: 方案名称
- `description`: 适用场景说明
- `tradeoff`: 权衡描述
- `estimatedUserTime`: 预计用户投入时间
- `riskLevel`: 风险等级 L0-L3
- `qualityCeiling`: 质量上限 1-10
- `isRecommended`: 是否推荐

---

## 4. 场景 1：课程 Presentation

### 4.1 用户目标

下周要汇报，想快速从老师资料里做出一份能讲、能改、能导出的 PPT。

### 4.2 完整功能流

```
用户输入 ──► 任务捕获 ──► 任务理解卡 ──► A/B/C 选题 ──► 页级大纲
                                                        │
导出 PPTX ◄── Human Gate ◄── 一致性检查 ◄── 讲稿与计时 ◄── PPT v0 生成
```

#### Step 1: 任务捕获

用户在对话窗口输入：
> "下周三 10 分钟机器学习 presentation"

可同时上传：课程 PDF / PPT / 截图 / Word / 笔记

**现有模块复用**：
- `Source` 模型存储上传文件
- `DocumentPipeline`（`document-intelligence`）解析资料
- `UnderstandingAgent`（`agent-os`）理解任务

**新增数据结构**：`PresentationBrief`

```typescript
interface PresentationBrief {
  id: string;
  projectId: string;
  deliverableType: "course_ppt" | "lab_meeting" | "exam_review";
  presentationDuration: number;       // 分钟
  deadline: string | null;
  targetAudience: string;
  sourceIds: string[];
  missingInfo: string[];
  detectedCourseName: string | null;
  requiresSpeakerNotes: boolean;
  requiresEnglish: boolean;
  pageRequirement: number | null;
}
```

#### Step 2: 任务理解卡

Agent 在对话中展示结构化理解结果，Canvas 同步渲染：

```
┌─ 任务理解 ──────────────────────────┐
│  交付物: PPT                        │
│  汇报时长: 10 分钟                   │
│  截止时间: 下周三                    │
│  目标受众: 老师/同学                 │
│  资料数量: 3 份                      │
│  缺失信息: 是否有页数要求？           │
│           是否需要英文？              │
│           是否需要讲稿？              │
└─────────────────────────────────────┘
```

**现有模块复用**：
- `UnderstandingResult`（`agent-os/types`）已有 `goals` / `deliverables` / `dueDate` / `missingInfo`
- 扩展 `UnderstandingAgent.analyze()` 增加课程 PPT 专用字段提取

#### Step 3: A/B/C 选题方案

每个选题方案包含决策信息：

```typescript
interface TopicCandidate {
  id: string;
  title: string;
  angle: string;                    // 切入角度
  targetAudience: string;
  estimatedSlides: number;
  sourceCoverage: number;           // 0-1 资料覆盖率
  difficultyLevel: "easy" | "medium" | "hard";
  errorRisk: string;                // 出错风险描述
  canFillDuration: boolean;         // 是否容易讲满时长
  recommendationReason: string;     // 为什么推荐
  riskLevel: RiskLevel;
}
```

**现有模块复用**：
- `TopicCandidateSchema`（`ppt-cocreation/types`）已有 `id` / `title` / `angle` / `targetAudience` / `estimatedSlides` / `sourceCoverage` / `riskLevel`
- 扩展增加 `difficultyLevel` / `errorRisk` / `canFillDuration` / `recommendationReason`

**Canvas 渲染**：选题方案在 Canvas 中渲染为三张可点击卡片，用户点击即选择。

#### Step 4: 页级大纲

用户选题后生成 8-12 页大纲：

```typescript
interface SlidePlan {
  id: string;
  orderIndex: number;
  title: string;
  objective: string;                // 本页目标
  keyPoints: string[];
  evidenceRefs: string[];           // 引用资料来源
  responsibilityColor: ResponsibilityColor;
  speakerNotes: string;             // 讲稿要点
  estimatedDurationSeconds: number; // 本页预计时长
  layoutType: "title" | "content" | "two_column" | "image_focus" | "comparison" | "blank";
  status: "proposed" | "confirmed" | "generating" | "completed" | "needs_revision";
}
```

**现有模块复用**：
- `SlideOutlineSchema`（`ppt-cocreation/types`）已有大部分字段
- 扩展增加 `objective` / `estimatedDurationSeconds`

**Canvas 渲染**：大纲在 Canvas 左栏显示为可点击列表，点击某页在中间栏展示详细内容。

#### Step 5: 一键生成 PPT v0

基于大纲生成可编辑 PPT，每页包含：
- 标题、要点、布局
- 备注讲稿
- 证据来源标注

**现有模块复用**：
- `PPTCoCreationWorkflow`（`ppt-cocreation`）的 `generateOutline()` / `confirmAllSlides()` / `selectStyle()`
- `PptxRenderer`（`artifact-factory`）导出 PPTX
- `Artifact` + `ArtifactBlock` 存储每页内容

#### Step 6: 讲稿与计时

系统根据汇报时长自动控制每页讲多久，生成口语化讲稿，提示哪几页容易超时。

**新增数据结构**：`SpeakerNotes`

```typescript
interface SpeakerNotes {
  slideId: string;
  spokenText: string;               // 口语化讲稿
  estimatedDurationSeconds: number;
  pacingWarning: string | null;     // "本页内容较多，容易超时"
  keyTransition: string;            // 过渡到下一页的话术
}
```

**现有模块复用**：
- `skill_presentation_coach`（`skill-runtime/builtin-skills`）已有汇报教练能力
- `coaching` 包的 `meeting-briefer.ts` / `defense-simulator.ts`

#### Step 7: 导出前检查

检查项：
- 所有关键页是否有资料来源
- 是否存在 AI 推断内容（黄色/灰色标记）
- 页数是否过多
- 讲稿是否超时
- 是否需要 Human Gate 确认

**现有模块复用**：
- `VerifierAgent`（`agent-os`）做验证
- `HumanGate` 模型做关键确认
- `compliance` 包做引用/证据/风险检查（第三阶段启用）
- `PPTCoCreationWorkflow.runConsistencyCheck()` 做一致性检查

### 4.3 场景杀手点

用户不是得到一堆文字，而是得到"可选题、可讲、可导出、能改"的 PPT。

---

## 5. 场景 2：硕士组会论文汇报

### 5.1 用户目标

上传 3-8 篇论文，快速读懂、比较、做组会 PPT，并准备导师提问。

### 5.2 完整功能流

```
论文包上传 ──► 论文结构化精读 ──► 多篇对比矩阵 ──► A/B/C 汇报路径
                                                          │
导出 PPTX ◄── Human Gate ◄── 导师可能提问 ◄── 组会 PPT 大纲 ◄─┘
```

#### Step 1: 论文包上传

用户上传多篇 PDF，设置组会时间和汇报时长。

**现有模块复用**：
- `Source` 模型存储上传文件
- `DocumentPipeline`（`document-intelligence`）解析 PDF

**新增**：支持批量上传，自动识别论文类型（会议/期刊/预印本）。

#### Step 2: 论文结构化精读

每篇论文生成 Paper Card：

```typescript
interface PaperCard {
  id: string;
  sourceId: string;
  projectId: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  doi: string | null;
  researchQuestion: string;          // 研究问题
  backgroundMotivation: string;      // 背景动机
  methodFramework: string;           // 方法框架
  dataset: string;                   // 数据集/实验设置
  metricsAndResults: string;         // 指标与结果
  mainContributions: string;         // 主要贡献
  limitations: string;               // 局限性
  reproducibility: string;           // 可复现性
  keyFigures: string[];              // 关键图表描述
  references: string[];              // 参考文献
  evidencePageNumbers: Record<string, number[]>;  // 字段→页码映射
  responsibilityColor: ResponsibilityColor;
}
```

**现有模块复用**：
- `PaperMatrixSchema`（`paper-reading/types`）已有 `sourceId` / `problem` / `method` / `data` / `metrics` / `mainResults` / `limitations` / `futureWork` / `relevanceToProject` / `responsibilityColor`
- `research` 包的 `PaperReader` 和 `PaperEntry` / `PaperMatrix` 类型
- 扩展 `PaperMatrixSchema` 增加更多结构化字段

**Canvas 渲染**：Paper Cards 在 Canvas 中渲染为可展开的卡片列表，每张卡片显示核心字段，点击展开完整信息。

#### Step 3: 多篇论文对比矩阵

这是核心交付物。矩阵列固定：

| Paper | Problem | Method | Dataset | Metric | Result | Strength | Weakness | Relation | Usable? |
|-------|---------|--------|---------|--------|--------|----------|----------|----------|---------|

**现有模块复用**：
- `ComparisonMatrixSchema`（`paper-reading/types`）已有 `projectId` / `papers` / `methodCategories` / `timeline` / `controversies` / `researchGaps` / `suggestedOutline`
- `ComparisonField` 已有 `field` / `values` 结构

**新增数据结构**：`PaperComparisonMatrix`

```typescript
interface PaperComparisonMatrix {
  id: string;
  projectId: string;
  papers: PaperCard[];
  comparisonFields: ComparisonField[];
  methodCategories: string[];
  timeline: TimelineEntry[];
  controversies: ControversyPoint[];
  researchGaps: string[];
  suggestedOutline: OutlineSection[];
}

interface ControversyPoint {
  topic: string;
  positions: Array<{ sourceId: string; position: string }>;
}

interface OutlineSection {
  section: string;
  keyPoints: string[];
}
```

**Canvas 渲染**：对比矩阵在 Canvas 中渲染为可排序、可筛选的表格，支持点击单元格查看来源页码。

#### Step 4: A/B/C 汇报路径

```typescript
interface PresentationPath {
  id: string;
  pathType: "deep_dive" | "comparison" | "evolution";
  title: string;
  description: string;
  suitableScenario: string;
  estimatedSlides: number;
  estimatedDuration: number;
  focusPapers: string[];             // 重点论文 sourceId
  outlineSections: string[];
  riskLevel: RiskLevel;
  isRecommended: boolean;
}
```

三种路径：
- **A. 主论文精讲型**：适合有一篇核心论文，讲得深入
- **B. 多论文对比型**：适合组会讨论，突出方法、实验、局限对比
- **C. 研究脉络型**：适合讲一个方向的发展，适合开题/综述前期

**Canvas 渲染**：路径选择在对话中渲染为 A/B/C 决策卡，选择后 Canvas 自动切换到对应大纲结构。

#### Step 5: 组会 PPT 大纲

根据所选路径生成：

```
1. 研究背景
2. 论文关系图
3. 单篇论文精读
4. 多篇方法对比
5. 实验结果横向比较
6. 局限与可复现性
7. 我的问题/下一步计划
8. 导师讨论页
```

**现有模块复用**：
- `PPTCoCreationWorkflow` 生成大纲
- `SlideOutline` / `SlidePlan` 存储每页内容

#### Step 6: 导师可能提问

自动生成 10-15 个问题：

```typescript
interface AdvisorQuestion {
  id: string;
  projectId: string;
  question: string;
  category: "method" | "data" | "result" | "reproducibility" | "extension" | "weakness";
  relatedSourceIds: string[];
  suggestedAnswer: string;
  difficultyLevel: "basic" | "intermediate" | "challenging";
  evidenceRefs: string[];
}
```

**现有模块复用**：
- `coaching` 包的 `defense-simulator.ts` / `socratic-coach.ts`
- `skill_presentation_coach`

**Canvas 渲染**：导师问题在 Canvas 右栏 Inspector 中显示，每个问题可展开查看建议回答和证据来源。

#### Step 7: 证据链检查

每个结论绑定论文页码、图表或段落。没有证据的内容默认灰色，不能伪装成事实。

**现有模块复用**：
- `Evidence` 模型存储页码、段落、图表、引用
- `compliance` 包的 `traceability-reporter.ts` 生成可追溯报告（第三阶段启用）
- `VerifierAgent` 检查证据覆盖

**新增数据结构**：`EvidenceCoverageReport`

```typescript
interface EvidenceCoverageReport {
  id: string;
  projectId: string;
  artifactId: string;
  totalClaims: number;
  greenClaims: number;               // 有直接证据
  yellowClaims: number;              // 有间接证据/AI推断
  grayClaims: number;                // 无证据
  greenRatio: number;
  yellowRatio: number;
  grayRatio: number;
  unverifiedCitations: number;
  highRiskItems: string[];
}
```

**现有模块复用**：
- `TraceabilityReport`（`compliance/types`）已有 `greenRatio` / `yellowRatio` / `grayRatio` / `unverifiedCitations` / `highRiskItems`（第三阶段启用）

### 5.3 场景杀手点

用户得到的不是"论文摘要"，而是"可以直接拿去组会讲的逻辑、PPT、问题准备"。

---

## 6. 后台 Agent 调度设计

### 6.1 Agent 协作架构

用户只看到一个 AI，但后台是一组 Agent 协作：

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentOrchestrator                         │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ TaskUnderstanding│  │ SourceParsing    │  │ Evidence     │ │
│  │ Agent            │  │ Agent            │  │ Agent        │ │
│  │                  │  │                  │  │              │ │
│  │ 理解用户目标     │  │ 解析 PDF/PPT/   │  │ 建立证据锚点  │ │
│  │ 截止日期、产物   │  │ Word/论文        │  │ 绑定页码段落  │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                   │        │
│  ┌────────▼────────┐  ┌───────▼─────────┐  ┌─────▼──────┐ │
│  │ PlanningAgent   │  │ PaperReading     │  │ Verifier   │ │
│  │                 │  │ Agent            │  │ Agent      │ │
│  │ 生成 A/B/C 路径 │  │ Paper Card       │  │ 证据覆盖    │ │
│  │ 任务分解        │  │ 对比矩阵         │  │ 幻觉风险    │ │
│  └────────┬────────┘  │ 汇报路径         │  │ 引用风险    │ │
│           │           └────────┬────────┘  └──────┬─────┘ │
│  ┌────────▼────────┐  ┌───────▼─────────┐  ┌─────▼──────┐ │
│  │ Presentation    │  │ CanvasAgent      │  │ HumanGate  │ │
│  │ Agent           │  │                  │  │ Agent      │ │
│  │ PPT 大纲和内容  │  │ 把结果持续写入   │  │ 判断哪里    │ │
│  │ 讲稿生成        │  │ Canvas           │  │ 必须用户确认│ │
│  └─────────────────┘  └─────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 现有 Agent OS 复用

现有 `agent-os` 包已实现：
- `UnderstandingAgent`：理解任务（已有 `analyze()` 方法）
- `PlannerAgent`：生成三方案（已有 `generateThreePlans()` 方法）
- `DispatcherAgent`：任务分发
- `WorkerAgent`：任务执行
- `VerifierAgent`：结果验证
- `ReflectionEngine`：反思与知识沉淀
- `AgentPipeline`：串联上述 Agent 的流水线

**改造方向**：
1. `UnderstandingAgent.analyze()` 增加课程 PPT 和组会论文汇报的专用字段提取
2. `PlannerAgent.generateThreePlans()` 的三方案映射到 A/B/C 决策卡
3. `AgentPipeline.run()` 增加关键节点暂停等待用户选择的能力
4. 新增 `CanvasAgent` 负责将中间结果实时写入 Canvas
5. 新增 `PaperReadingAgent` 调用 `paper-reading` / `research` 包
6. 新增 `PresentationAgent` 调用 `ppt-cocreation` 包

### 6.3 Agent 交互节奏

Agent 不应该一次性问用户十个问题，而是像一个会推进项目的助手：

1. **用户说任务** → Agent 理解并展示任务理解卡
2. **Agent 给 A/B/C 方向** → 用户点一个，Canvas 自动切换结构
3. **Agent 后台跑任务** → 对话里显示进度，Canvas 同步出现结果
4. **Agent 在关键节点再问** → 给用户选择，不替用户决定

关键原则：**Agent 只在关键选择点打断用户，其余时间在后台推进。**

### 6.4 Agent 过程可视化 — 让技术被用户真实感知

这是知序区别于普通聊天工具的核心体验差异：用户不是在和一个黑箱聊天，而是在观察和指挥一组协作 Agent 完成任务。

#### 设计理念

```
传统 AI 产品：  用户 → [黑箱] → 结果
知序：          用户 → [Agent A 正在解析论文...] → [Agent B 正在生成对比矩阵...] → 结果
                      ↕ 用户能看到、能干预、能理解
```

用户应该能：
1. **看到谁在做什么** — 每个 Agent 的角色、当前任务、输入输出
2. **看到协作过程** — Agent 之间如何传递信息、如何分工
3. **看到思考链路** — Agent 为什么做这个决策、基于什么信息
4. **随时介入** — 在任何节点打断、修改、重定向

#### Agent 过程面板

在对话区和 Canvas 之间，增加一个可折叠的 **Agent Process Panel**：

```
┌──────────────────────────────────────────────────────────────────────┐
│  Header: 知序 · 3 个 Agent 正在协作 · 点击展开详情                   │
├──────────────────────┬──────────────────┬───────────────────────────┤
│                      │  Agent Process   │                           │
│  Conversation Layer  │  Panel (可折叠)   │     Canvas Layer          │
│                      │                  │                           │
│  用户: 选B，多论文    │  ┌────────────┐  │   ┌─ 对比矩阵 ─────────┐ │
│  对比型              │  │ 🔍 Source   │  │   │ Paper | Method |.. │ │
│                      │  │ Parsing     │  │   │ P1    | Trans.. |  │ │
│  知序: 好的，我正在   │  │ Agent       │  │   │ P2    | BERT   |  │ │
│  安排 Agent 协作...   │  │             │  │   └────────────────────┘ │
│                      │  │ ✅ 解析     │  │                           │
│                      │  │  论文1.pdf  │  │   ┌─ PPT 大纲 ─────────┐ │
│                      │  │  论文2.pdf  │  │   │ 1. 研究背景         │ │
│                      │  │ 🔄 解析中   │  │   │ 2. 方法对比         │ │
│                      │  │  论文3.pdf  │  │   │ 3. 实验结果         │ │
│                      │  ├────────────┤  │   └────────────────────┘ │
│                      │  │ 📊 Paper    │  │                           │
│                      │  │ Reading     │  │                           │
│                      │  │ Agent       │  │                           │
│                      │  │             │  │                           │
│                      │  │ ✅ Paper    │  │                           │
│                      │  │  Card #1    │  │                           │
│                      │  │ 🔄 生成中   │  │                           │
│                      │  │  Card #2    │  │                           │
│                      │  ├────────────┤  │                           │
│                      │  │ 🎨 Present- │  │                           │
│                      │  │ ation Agent │  │                           │
│                      │  │             │  │                           │
│                      │  │ ⏳ 等待     │  │                           │
│                      │  │  Paper Cards│  │                           │
│                      │  └────────────┘  │                           │
└──────────────────────┴──────────────────┴───────────────────────────┘
```

#### Agent 卡片设计

每个 Agent 渲染为一张实时状态卡片：

```
┌─ 🔍 Source Parsing Agent ──────────────────────────┐
│                                                      │
│  状态: 🔄 工作中                                     │
│  任务: 解析上传的 5 篇论文 PDF                        │
│                                                      │
│  进度:                                               │
│  ✅ 论文1.pdf — 12页，已提取结构 (2.3s)              │
│  ✅ 论文2.pdf — 8页，已提取结构 (1.8s)               │
│  🔄 论文3.pdf — 解析中... 6/10页                     │
│  ⏳ 论文4.pdf — 排队中                               │
│  ⏳ 论文5.pdf — 排队中                               │
│                                                      │
│  输出 → Paper Reading Agent                          │
│  [点击查看解析结果]                                   │
└──────────────────────────────────────────────────────┘
```

每张 Agent 卡片的字段：

```typescript
interface AgentProcessCard {
  agentId: string;
  agentName: string;
  agentIcon: string;                 // emoji 或图标
  agentRole: string;                 // 一句话描述角色
  status: "idle" | "working" | "waiting" | "completed" | "failed";
  currentTask: string;               // 当前正在做什么
  progress: ProgressDetail[];        // 子任务进度列表
  inputFrom: string[];               // 从哪些 Agent 接收输入
  outputTo: string[];                // 输出给哪些 Agent
  thinkingLog: ThinkingEntry[];      // 思考/决策日志
  startedAt: string;
  estimatedCompletion: string | null;
}

interface ProgressDetail {
  label: string;                     // "论文1.pdf"
  status: "completed" | "in_progress" | "queued" | "failed" | "skipped";
  detail: string;                    // "12页，已提取结构 (2.3s)"
  percentage: number;                // 0-100
}

interface ThinkingEntry {
  timestamp: string;
  type: "decision" | "observation" | "plan" | "error";
  content: string;                   // "发现论文3和论文5方法最接近，建议重点对比"
  relatedEvidence?: string[];        // 关联的证据 ID
}
```

#### Agent 协作流可视化

除了单个 Agent 卡片，还要展示 Agent 之间的协作关系：

```
┌─ Agent 协作流 ──────────────────────────────────────────────────┐
│                                                                  │
│  [Task Understanding] ──→ [Source Parsing] ──→ [Paper Reading]  │
│        ✅ 完成               🔄 工作中            ⏳ 等待输入     │
│                                  │                               │
│                                  ↓                               │
│                          [Planning Agent] ──→ [Presentation]     │
│                              ⏳ 等待输入         ⏳ 等待输入      │
│                                                                  │
│  当前瓶颈: Source Parsing Agent 正在解析论文3                     │
│  已用时间: 1m 23s                                                 │
│  预计剩余: 2m 15s                                                 │
└──────────────────────────────────────────────────────────────────┘
```

协作流用有向图渲染，节点是 Agent，边是数据传递方向。每个节点实时更新状态颜色：
- 灰色 = idle
- 蓝色脉冲 = working
- 黄色 = waiting
- 绿色 = completed
- 红色 = failed

#### 对话区 Agent 消息增强

Agent 在对话区不再是纯文字输出，而是结构化的过程消息：

**旧方式**：
```
知序: 正在生成对比矩阵和PPT大纲...
```

**新方式**：
```
┌─ 知序 ──────────────────────────────────────────────┐
│                                                      │
│  已安排 3 个 Agent 协作处理你的任务：                  │
│                                                      │
│  🔍 Source Parsing Agent                              │
│     正在解析 5 篇论文 → 已完成 2/5                    │
│     [点击查看详情]                                    │
│                                                      │
│  📊 Paper Reading Agent                               │
│     等待解析完成后自动开始                             │
│                                                      │
│  🎨 Presentation Agent                               │
│     等待论文阅读完成后生成 PPT                         │
│                                                      │
│  💡 我发现论文1和论文3都涉及 Transformer 架构，        │
│     建议在对比矩阵中重点突出这一关联。                  │
│     [同意] [换个重点]                                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Agent 思考链路展示

用户可以点击任何 Agent 卡片展开"思考链路"：

```
┌─ 📊 Paper Reading Agent — 思考链路 ─────────────────┐
│                                                      │
│  10:23:15 [观察] 论文1 使用 Transformer 架构         │
│  10:23:18 [观察] 论文3 也使用 Transformer，但改进了  │
│                 位置编码方式                           │
│  10:23:20 [决策] 将论文1和3归为"同一方法演进"分组    │
│  10:23:22 [计划] 对比矩阵中增加"位置编码"对比维度    │
│  10:23:25 [观察] 论文5 的方法与以上完全不同，是       │
│                 GNN 方向                              │
│  10:23:27 [决策] 建议汇报路径 B（多论文对比型），     │
│                 因为方法差异大，适合横向比较           │
│                                                      │
│  [基于这些观察，我想调整方向] [继续自动推进]           │
└──────────────────────────────────────────────────────┘
```

思考链路不是事后生成的日志，而是 Agent 运行时实时推送的 `ThinkingEntry`。前端通过 SSE 实时渲染。

#### 用户介入点

Agent 过程可见的核心价值不只是"看着"，而是"能介入"。设计以下介入方式：

| 介入方式 | 触发条件 | 交互形式 |
|----------|---------|---------|
| **调整优先级** | 多个 Agent 排队时 | 拖拽 Agent 卡片调整执行顺序 |
| **修改输入** | Agent 等待输入时 | 点击 Agent 卡片修改输入参数 |
| **中断重定向** | Agent 思考方向不对 | 点击"换个方向"按钮，输入新指令 |
| **确认决策** | Agent 做出关键决策时 | A/B/C 决策卡或确认按钮 |
| **跳过步骤** | 某步不必要 | 点击"跳过"按钮 |
| **重试失败** | Agent 执行失败 | 点击"重试"按钮 |
| **查看中间结果** | 任何时刻 | 点击 Agent 卡片查看当前输出 |

#### Agent 过程消息类型

扩展消息类型，支持 Agent 过程展示：

```typescript
export type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCallInfo[]; thinking?: string; files?: FileInfo[] }
  | { role: "assistant"; content: string; decisionCards?: DecisionCardSet }
  | { role: "assistant"; content: string; taskBrief?: PresentationBrief }
  | { role: "assistant"; content: string; progress?: ProgressEvent }
  | { role: "assistant"; content: string; agentProcess?: AgentProcessUpdate }    // 新增
  | { role: "assistant"; content: string; agentThinking?: ThinkingEntry }        // 新增
  | { role: "assistant"; content: string; agentCollaboration?: CollaborationSnapshot } // 新增
  | { role: "gate"; gateId: string; gateType: string; reason: string; riskLevel: string; resolved: boolean }
  | { role: "system"; content: string };

interface AgentProcessUpdate {
  agentId: string;
  agentName: string;
  status: AgentProcessCard["status"];
  currentTask: string;
  progress: ProgressDetail[];
  outputPreview?: Record<string, unknown>;  // 中间结果预览
}

interface CollaborationSnapshot {
  agents: Array<{
    agentId: string;
    agentName: string;
    status: AgentProcessCard["status"];
  }>;
  edges: Array<{
    from: string;
    to: string;
    dataType: string;               // "parsed_documents" | "paper_cards" | "comparison_matrix" | "outline"
  }>;
  bottleneck: string | null;        // 当前阻塞节点
  elapsedTime: number;              // 秒
  estimatedRemaining: number | null; // 秒
}
```

#### 实时推送机制

Agent 过程通过 SSE 实时推送，不等待完成：

```
SSE 事件流:

event: agent_status
data: {"agentId":"source_parsing","status":"working","currentTask":"解析论文3.pdf","progress":[...]}

event: agent_thinking
data: {"agentId":"paper_reading","type":"observation","content":"论文1和论文3方法接近"}

event: agent_output
data: {"agentId":"paper_reading","outputType":"paper_card","preview":{"title":"Attention Is All You Need",...}}

event: collaboration_update
data: {"agents":[...],"edges":[...],"bottleneck":"source_parsing","elapsedTime":83,"estimatedRemaining":135}

event: agent_decision
data: {"agentId":"planning","decision":"建议选择路径B","reasoning":"方法差异大，适合横向比较","options":[...]}
```

#### 折叠/展开策略

Agent Process Panel 默认折叠为一行摘要，用户可展开：

**折叠态**（默认）：
```
┌─ 🔍 解析中(2/5) → 📊 等待中 → 🎨 等待中 · 已用时 1m23s ──────────┐
└──────────────────────────────────────────────────────────────────────┘
```

**展开态**：显示完整 Agent 卡片列表 + 协作流图

**全屏态**：点击任意 Agent 卡片可全屏查看详细思考链路和中间结果

#### 场景示例：组会论文汇报的完整 Agent 过程

```
用户: "下周三组会，读这5篇论文做PPT"
  │
  ▼
[Task Understanding Agent] ✅
  → 识别: 组会论文汇报, 5篇论文, 15分钟
  → 输出: 任务理解卡
  │
  ▼
[Source Parsing Agent] 🔄
  → 解析论文1.pdf ✅ (2.3s)
  → 解析论文2.pdf ✅ (1.8s)
  → 解析论文3.pdf 🔄 解析中... 6/10页
  → 解析论文4.pdf ⏳
  → 解析论文5.pdf ⏳
  │
  ├── 中间结果实时推送 → Canvas 显示已解析论文的 Paper Card
  │
  ▼ (论文3解析完成后)
[Paper Reading Agent] 🔄
  → 生成 Paper Card #1 ✅
  → 生成 Paper Card #2 ✅
  → 生成 Paper Card #3 🔄
  → 💡 思考: "论文3改进了论文1的位置编码，建议重点对比"
  │
  ├── 思考链路实时推送到对话区
  │
  ▼ (所有 Paper Cards 完成)
[Planning Agent] 🔄
  → 生成3种汇报路径
  → 输出: A/B/C 决策卡
  │
  ▼ (用户选择路径B)
[Presentation Agent] 🔄
  → 生成对比矩阵 🔄
  → 生成 PPT 大纲 ⏳
  → 生成讲稿 ⏳
  → 生成配图 ⏳
  │
  ├── Canvas 实时更新: 矩阵 → 大纲 → 页面内容
  │
  ▼
[Image Intent Detector] 🔄
  → 分析第3页: 需要方法架构图
  → 调用 SenseNova T2I 🔄
  → 分析第5页: 需要实验对比图
  → 调用 SenseNova T2I ⏳
  │
  ├── 图片生成后实时出现在 Canvas
  │
  ▼
[Export Agent] ✅
  → 生成 PPTX
  → Human Gate 确认
  → 导出完成
```

---

## 7. 新增数据结构

### 7.1 对话层新增

```typescript
// 决策卡集合 — A/B/C 选择
interface DecisionCardSet {
  type: "decision_cards";
  title: string;
  recommendedOptionId: string;
  options: DecisionCardOption[];
}

interface DecisionCardOption {
  id: string;
  title: string;
  description: string;
  tradeoff: string;
  estimatedUserTime: string;
  riskLevel: RiskLevel;
  qualityCeiling: number;
  isRecommended: boolean;
}
```

### 7.2 Canvas 层新增

```typescript
// Canvas 增量更新 — Agent 把结果持续写入画布
interface CanvasPatch {
  artifactId: string;
  operation: "upsert_block" | "delete_block" | "update_block" | "bind_evidence" | "set_responsibility";
  blockType: string;
  contentJson: Record<string, unknown>;
  evidenceRefs: string[];
  responsibilityColor: ResponsibilityColor;
  orderIndex?: number;
}

// Agent 会话 — 贯穿一次完整任务
interface AgentSession {
  id: string;
  projectId: string;
  workflowIntent: "course_presentation" | "lab_meeting" | "general";
  currentPhase: AgentPhase;
  brief: PresentationBrief | null;
  selectedDecision: string | null;
  canvasState: CanvasDocument;
  progressEvents: ProgressEvent[];
  createdAt: string;
  updatedAt: string;
}

type AgentPhase =
  | "task_capture"
  | "understanding"
  | "decision"
  | "source_parsing"
  | "paper_reading"
  | "matrix_generation"
  | "outline_generation"
  | "content_generation"
  | "speaker_notes"
  | "verification"
  | "human_gate"
  | "export_ready"
  | "completed";

interface ProgressEvent {
  phase: AgentPhase;
  message: string;
  timestamp: string;
  percentage: number;               // 0-100
}
```

### 7.3 消息类型扩展

现有 `Msg` 类型（`chat-context.tsx`）扩展（与 6.4 节 Agent 过程消息类型统一）：

```typescript
export type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCallInfo[]; thinking?: string; files?: FileInfo[] }
  | { role: "assistant"; content: string; decisionCards?: DecisionCardSet }
  | { role: "assistant"; content: string; taskBrief?: PresentationBrief }
  | { role: "assistant"; content: string; progress?: ProgressEvent }
  | { role: "assistant"; content: string; agentProcess?: AgentProcessUpdate }
  | { role: "assistant"; content: string; agentThinking?: ThinkingEntry }
  | { role: "assistant"; content: string; agentCollaboration?: CollaborationSnapshot }
  | { role: "gate"; gateId: string; gateType: string; reason: string; riskLevel: string; resolved: boolean }
  | { role: "system"; content: string };
```

### 7.4 数据库 Schema 扩展

在 `schema.prisma` 中新增：

```prisma
model AgentSession {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id])
  workflowIntent  String   @default("general")
  currentPhase    String   @default("task_capture")
  briefJson       Json     @default("{}")
  selectedDecision String?
  canvasStateJson  Json    @default("{}")
  progressJson    Json     @default("[]")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([projectId])
}
```

在 `Project` 模型中增加关联：

```prisma
model Project {
  // ... 现有字段 ...
  agentSessions AgentSession[]
}
```

---

## 8. 前端组件设计

### 8.1 新增组件清单

| 组件 | 位置 | 职责 |
|------|------|------|
| `AgentCanvasWorkspace` | `apps/web/app/page.tsx` | 主页面三栏布局容器（对话 + Agent面板 + Canvas） |
| `ConversationPanel` | `apps/web/components/` | 左侧对话面板 |
| `AgentProcessPanel` | `apps/web/components/` | 中间 Agent 过程面板（可折叠） |
| `AgentProcessCard` | `apps/web/components/` | 单个 Agent 实时状态卡片 |
| `AgentCollaborationGraph` | `apps/web/components/` | Agent 协作流有向图 |
| `AgentThinkingLog` | `apps/web/components/` | Agent 思考链路展示 |
| `AgentInterventionBar` | `apps/web/components/` | 用户介入操作栏（调整/中断/跳过/重试） |
| `CollaborationTimeline` | `apps/web/components/` | 协作时间线（折叠态摘要条） |
| `CanvasPanel` | `apps/web/components/` | 右侧 Canvas 面板 |
| `DecisionCardSet` | `apps/web/components/` | A/B/C 决策卡渲染 |
| `TaskBriefCard` | `apps/web/components/` | 任务理解卡渲染 |
| `PaperCardList` | `apps/web/components/` | Paper Cards 列表 |
| `ComparisonMatrix` | `apps/web/components/` | 对比矩阵表格 |
| `SlideOutlineList` | `apps/web/components/` | PPT 大纲列表 |
| `SlideEditor` | `apps/web/components/` | 单页内容编辑 |
| `AgentInspector` | `apps/web/components/` | 右侧证据/风险/讲稿面板 |
| `SpeakerNotesPanel` | `apps/web/components/` | 讲稿与计时 |
| `AdvisorQuestionList` | `apps/web/components/` | 导师问题列表 |
| `EvidenceCoverageBar` | `apps/web/components/` | 证据覆盖率进度条 |
| `ProgressIndicator` | `apps/web/components/` | Agent 进度指示器 |

### 8.2 Canvas Layer 状态管理

Canvas 的内容由 `AgentSession.canvasState` 驱动。Agent 后台推进时通过 `CanvasPatch` 增量更新。

```typescript
// Canvas 状态
interface CanvasState {
  activeView: "brief" | "papers" | "matrix" | "outline" | "slide_detail" | "questions";
  brief: PresentationBrief | null;
  paperCards: PaperCard[];
  comparisonMatrix: PaperComparisonMatrix | null;
  slidePlans: SlidePlan[];
  selectedSlideId: string | null;
  speakerNotes: SpeakerNotes[];
  advisorQuestions: AdvisorQuestion[];
  evidenceCoverage: EvidenceCoverageReport | null;
  progress: ProgressEvent[];
}
```

### 8.3 对话消息渲染规则

| 消息类型 | 对话区渲染 | Agent Panel 渲染 | Canvas 渲染 |
|----------|-----------|-----------------|-------------|
| `taskBrief` | 简要文字 + "已在右侧展示任务理解" | — | 任务理解卡 |
| `decisionCards` | A/B/C 可点击卡片 | — | 选择后 Canvas 切换结构 |
| `progress` | 进度条 + 文字 | — | Canvas 对应区域更新 |
| `agentProcess` | 一行摘要 | Agent 卡片状态更新 | — |
| `agentThinking` | 思考气泡（可展开） | 思考链路追加条目 | — |
| `agentCollaboration` | — | 协作流图更新 | — |
| `toolCalls` | 工具调用卡片（现有） | — | 无直接变化 |
| `gate` | Human Gate 确认卡片（现有） | — | 风险标记 |
| 普通文字 | Markdown 渲染（现有） | — | 无直接变化 |

---

## 9. API 设计

### 9.1 新增 API 端点

```
POST   /api/agent-sessions                    创建 Agent 会话
GET    /api/agent-sessions/:id                获取会话状态
PATCH  /api/agent-sessions/:id                更新会话（选择决策等）
POST   /api/agent-sessions/:id/advance        推进到下一阶段

POST   /api/agent-sessions/:id/canvas-patch   Agent 写入 Canvas 增量
GET    /api/agent-sessions/:id/canvas          获取完整 Canvas 状态

POST   /api/paper-cards                       生成 Paper Card
GET    /api/paper-cards?projectId=:id         获取项目的 Paper Cards

POST   /api/comparison-matrices               生成对比矩阵
GET    /api/comparison-matrices?projectId=:id  获取项目的对比矩阵

POST   /api/advisor-questions                 生成导师问题
GET    /api/advisor-questions?projectId=:id   获取项目的导师问题

POST   /api/speaker-notes                    生成讲稿
GET    /api/speaker-notes?artifactId=:id      获取讲稿

GET    /api/evidence-coverage?artifactId=:id  获取证据覆盖率报告
```

### 9.2 现有 API 复用

| 现有端点 | 用途 |
|----------|------|
| `POST /api/projects` | 创建项目 |
| `POST /api/projects/:id/sources` | 上传资料 |
| `POST /api/projects/:id/events` | 推进项目状态 |
| `GET /api/artifacts/:id/blocks` | 获取 Artifact 块列表 |
| `POST /api/artifacts/:id/generate-all` | 生成全部幻灯片 |
| `POST /api/artifacts/:id/export-pptx` | 导出 PPTX |
| `POST /api/human-gates/:id/confirm` | 确认 Human Gate |
| `POST /api/chat` | 对话（流式） |
| `POST /api/chat-stream` | 对话（SSE 流式） |

---

## 10. 开源依赖引入方案

### 10.1 文档解析层

| 库 | 用途 | 引入方式 | 对应现有模块 |
|----|------|---------|-------------|
| **Docling** | 高质量资料解析主路径（PDF/DOCX/PPTX/XLSX/HTML/图片，page layout、reading order、table structure、公式、OCR） | 新增 `packages/document-intelligence/src/docling-provider.ts` | `document-intelligence/provider.ts` |
| **MarkItDown** | 快速轻解析 fallback（PDF/PPT/Word/Excel/图片/HTML → Markdown） | 已有 `markitdown-provider.ts`，继续使用 | `document-intelligence/markitdown-provider.ts` |
| **GROBID** | 论文专用解析（标题/作者/摘要/参考文献/引用上下文/章节结构/图表/PDF坐标） | 新增 `packages/document-intelligence/src/grobid-provider.ts` | `research/paper-reader.ts` |
| **MinerU** | 后续增强：复杂版面、中文材料、扫描件、图表提取 | 第二阶段引入 | - |
| **Marker** | 后续增强：PDF/图片/PPTX/DOCX/XLSX/HTML/EPUB，表格/公式/引用/图片 | 第二阶段引入 | - |

### 10.2 PPT 生成层

| 库 | 用途 | 引入方式 | 对应现有模块 |
|----|------|---------|-------------|
| **PptxGenJS** | 最终 PPTX 导出核心 | 继续使用，深化模板 | `artifact-factory/pptx-renderer.ts` |
| **Slidev** | Markdown-first 预览体验参考 | 不直接引入，参考其预览交互设计 | Canvas 前端预览 |
| **Marp** | Markdown-first 预览体验参考 | 不直接引入，参考其预览交互设计 | Canvas 前端预览 |

### 10.3 论文处理层

| 库 | 用途 | 引入方式 | 对应现有模块 |
|----|------|---------|-------------|
| **PaperQA2** | 科学文献 RAG 思路参考（证据检索、重排、带引用回答、文献元数据补全） | 不整体引入，参考其 evidence gather 模式 | `research/` |

### 10.4 Provider Router 设计

`DocumentPipeline` 升级为 provider router，根据文件类型和场景自动选择解析路径：

```typescript
interface DocumentPipelineConfig {
  providers: {
    markitdown: { priority: 0; maxFileSize: 50_000_000; supportedTypes: string[] };
    docling:    { priority: 1; maxFileSize: 100_000_000; supportedTypes: string[] };
    grobid:     { priority: 2; supportedTypes: ["application/pdf"]; scenario: "paper_reading" };
  };
  fallbackChain: ["grobid", "docling", "markitdown"];
  scenarioOverrides: {
    lab_meeting: { pdf: "grobid" };
    course_presentation: { pdf: "docling"; pptx: "docling" };
  };
}
```

---

## 11. 开发阶段与优先级


目标：让用户能在一个对话窗口里完成"课程 PPT"或"组会论文汇报"的端到端流程。

| 序号 | 任务 | 涉及模块 | 依赖 |
|------|------|---------|------|
| 1 | 主页面改造为三栏布局（对话 + Agent面板 + Canvas） | `apps/web/app/page.tsx` | 无 |
| 2 | `AgentSession` 数据模型 + API | `packages/db/`, `apps/server/` | 无 |
| 3 | `DecisionCardSet` 消息类型 + 前端渲染 | `chat-context.tsx`, 前端组件 | 1 |
| 4 | `TaskBriefCard` 任务理解卡 | `agent-os/understanding.ts`, 前端组件 | 1, 2 |
| 5 | 真实文件上传和解析（Docling/MarkItDown router） | `document-intelligence/` | 2 |
| 6 | Agent Process Panel + Agent 卡片 + 协作流图 | 前端组件, SSE 推送 | 1, 2 |
| 7 | Agent 思考链路展示 + 用户介入操作 | 前端组件, `agent-os` | 6 |
| 8 | 课程 PPT：选题候选 + 页级大纲 + Canvas 渲染 | `ppt-cocreation/`, 前端组件 | 1-5 |
| 9 | 论文汇报：Paper Card + 对比矩阵 + Canvas 渲染 | `paper-reading/`, `research/`, 前端组件 | 1-5 |
| 10 | 每页/每个结论绑定 Evidence | `Evidence` 模型, Canvas Inspector | 8, 9 |
| 11 | 导出前 Human Gate 确认 | `HumanGate` | 8, 9, 10 |
| 12 | PPTX 导出 | `artifact-factory/pptx-renderer.ts` | 8 |

| 序号 | 任务 | 涉及模块 |
|------|------|---------|
| 11 | 讲稿计时训练 | `coaching/`, `SpeakerNotes` |
| 12 | 导师追问模拟 | `coaching/defense-simulator.ts`, `AdvisorQuestion` |
| 13 | 图表自动重绘 | `skill_diagram_generate` |
| 14 | 多版本对比 | `version/` |
| 15 | 知识胶囊复用 | `KnowledgeCapsule` |
| 16 | GROBID 论文专用解析 | `document-intelligence/grobid-provider.ts` |
| 17 | MinerU / Marker 复杂版面解析 | 第二阶段引入 |
| 18 | Canvas 三栏编辑模式 | 前端组件 |


| 序号 | 任务 |
|------|------|
| 19 | 期末复习闭环 |
| 20 | 多人协作场景 |
| 21 | 知识图谱可视化 |
| 22 | 本地优先高级解析 |

---

## 12. 验收指标

### 12.1 性能指标

| 指标 | 目标值 |
|------|--------|
| 用户上传资料后看到任务理解卡 | ≤ 60 秒 |
| 看到可选题目和 PPT 大纲 | ≤ 3 分钟 |
| 生成第一版可编辑 PPT | ≤ 8 分钟 |
| 每篇论文生成 Paper Card 结构字段 | ≥ 8 个 |
| 组会对比矩阵关键结论有证据来源 | 100% |
| 导出前绿色证据覆盖率 | ≥ 70% |
| 用户修改量（vs 重做） | ≤ 20-30% |

### 12.2 体验指标

| 指标 | 目标值 |
|------|--------|
| 用户能在 2 次对话内完成选题 | 是 |
| Canvas 实时同步（非等待全部生成完） | 是 |
| A/B/C 决策卡点击即生效 | 是 |
| 导出前所有灰色内容有明确提示 | 是 |
| 讲稿总时长与目标时长偏差 | ≤ 1 分钟 |

---

## 13. 现有模块复用清单

| 现有模块 | 复用方式 | 改动程度 |
|----------|---------|---------|
| `agent-os/UnderstandingAgent` | 任务理解，扩展课程/PPT专用字段 | 小改 |
| `agent-os/PlannerAgent` | 三方案→A/B/C决策卡 | 小改 |
| `agent-os/AgentPipeline` | 增加关键节点暂停能力 | 中改 |
| `agent-os/VerifierAgent` | 验证证据覆盖/幻觉风险 | 不改 |
| `agent-os/ReflectionEngine` | 项目完成后知识沉淀 | 不改 |
| `ppt-cocreation/PPTCoCreationWorkflow` | PPT共创流程 | 小改 |
| `ppt-cocreation/types` | 扩展TopicCandidate/SlideOutline字段 | 小改 |
| `paper-reading/types` | 扩展PaperMatrix字段 | 小改 |
| `research/PaperReader` | 论文精读 | 中改（接入GROBID） |
| `artifact-canvas/types` | CanvasBlock/CanvasOperation | 不改 |
| `artifact-canvas/engine` | Canvas操作引擎 | 不改 |
| `artifact-factory/pptx-renderer` | PPTX导出 | 不改 |
| `compliance/*` | 引用/证据/风险检查 | 第三阶段启用 |
| `skill-runtime/builtin-skills` | Skills作为Agent工具 | 不改 |
| `model-gateway` | 模型调用 | 不改 |
| `quota` | 成本控制 | 不改 |
| `coaching/*` | 汇报教练/答辩模拟 | 不改 |
| `mentor-feedback` | 导师反馈处理 | 不改 |
| `undergrad/*` | 本科场景增强 | 不改 |
| `grad/*` | 研究生场景增强 | 不改 |
| `version/*` | 版本沉淀 | 不改 |
| `offline/*` | 本地优先 | 不改 |
| `collab/*` | 协作 | 不改 |
| `db/prisma/schema` | 新增AgentSession模型 | 小改 |
| `chat-context.tsx` | 扩展Msg类型 | 小改 |
| `page.tsx` | 改造为三栏布局 | 大改 |
| `sidebar.tsx` | 不改 | 不改 |

---

## 14. PPT 模板系统与双模式生成

### 14.1 设计原则

PPT 生成不是"先选模板再填内容"，而是"Agent 根据内容自动选择最佳视觉表达方式"。

核心原则：
- **内容决定视觉**，不是视觉决定内容
- **两种模式并存**：Standard（可编辑 PPTX）和 Creative（全页 T2I 图）
- **模板不是静态 PPT 模板文件**，而是"布局规则 + 风格参数 + 图片生成策略"的组合
- **图片生成是自动的**，用户不需要手动触发，Agent 智能判断哪些位置需要图片

### 14.2 双模式架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    PPT 生成决策                                  │
│                                                                  │
│  用户任务 + 内容 + 受众 + 场景                                   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                             │
│  │ Mode Selector   │  Agent 自动判断，也可用户手动切换            │
│  │                 │                                              │
│  │ Standard 模式   │  → HTML 页面 → PPTX 导出                    │
│  │ 每页可编辑      │  适合：课程汇报、组会、需要后续修改           │
│  │ 文字为主+配图   │                                              │
│  │                 │                                              │
│  │ Creative 模式   │  → T2I 全页图 → PPTX 打包                   │
│  │ 每页一张完整图  │  适合：视觉冲击力强的展示、发布会风格         │
│  │ 视觉冲击力强    │                                              │
│  └─────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
```

#### Standard 模式（默认推荐）

- 每页是 HTML 渲染的可编辑页面，最终通过 Playwright 截图 + PptxGenJS 导出 PPTX
- 文字、图表、图片都是独立元素，用户可以在 PowerPoint 中编辑
- 图片由 SenseNova T2I 按需生成，嵌入到页面指定位置
- **现有复用**：`sn-ppt-standard` skill 的完整 pipeline（style → outline → asset-plan → gen-image → page-html → export）

#### Creative 模式

- 每页由 T2I 生成一张完整 16:9 PNG，所有视觉元素（标题、文字、装饰、配色、构图）都烤进图里
- 视觉冲击力最强，但用户无法在 PowerPoint 中编辑文字
- **现有复用**：`sn-ppt-creative` skill 的完整 pipeline（style_spec → outline → page_prompt → T2I → build_pptx）

#### 模式选择逻辑

Agent 根据以下信号自动判断，并在 A/B/C 决策卡中给出推荐：

| 信号 | 倾向 Standard | 倾向 Creative |
|------|--------------|---------------|
| 受众 | 老师/导师/评委（需要看内容细节） | 同学/大众（视觉冲击优先） |
| 后续编辑需求 | 需要改内容 | 不需要改 |
| 内容密度 | 高（数据、对比、引用多） | 低（概念、故事、展示为主） |
| 场景 | 组会汇报、课程作业 | 发布会、创意展示 |
| 证据链要求 | 高（需要标注来源） | 低 |

### 14.3 模板系统设计

模板不是传统的 .pptx 模板文件，而是"风格三元组 + 布局规则 + 图片策略"的组合。

#### 风格三元组

复用 `sn-ppt-standard` 的 style_catalog 体系：

```typescript
interface StyleTriple {
  designStyle: {
    id: number;
    nameZh: string;
    nameEn: string;
  };
  colorTone: {
    id: number;
    nameZh: string;
    nameEn: string;
  };
  primaryColor: {
    id: number;
    nameZh: string;
    nameEn: string;
    hex: string;
  };
  palette: {
    primary: string;
    accent: string;
    neutral: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseSizePx: number;
  };
}
```

现有 style_catalog 已有 **68 种设计风格 × 22 种色调 × 29 种主色**，覆盖从学术严谨到赛博朋克的全场景。

#### 知序场景预设

在 style_catalog 的通用选择逻辑之上，为知序的两个核心场景预设推荐风格：

**课程 Presentation 推荐风格**：

| 风格 | 适用场景 | design_style | color_tone | primary_color |
|------|---------|-------------|------------|---------------|
| 学术经典 | 论文汇报、组会 | 学术严谨 (14) | 浅色/亮色系 (2) | 藏蓝 (2) |
| 清新学术 | 课堂展示、轻松汇报 | 扁平现代 (5) | 冰川色系 (14) | 天蓝 (1) |
| 科技前沿 | AI/CS/技术类汇报 | 科技感 (1) | 深色/暗色系 (1) | 宝石蓝 (3) |
| 简约大气 | 通用课程汇报 | 简约大气 (61) | 中性色 (11) | 灰色系 (19) |
| 水墨中国 | 中文人文/社科 | 水墨中国风 (4) | 中性色 (11) | 墨绿 (8) |

**组会论文汇报推荐风格**：

| 风格 | 适用场景 | design_style | color_tone | primary_color |
|------|---------|-------------|------------|---------------|
| 学术严谨 | 标准组会 | 学术严谨 (14) | 浅色/亮色系 (2) | 藏蓝 (2) |
| 信息图表 | 多论文对比 | 信息图表 (35) | 冷色调 (4) | 宝石蓝 (3) |
| 简报仪表盘 | 数据密集型汇报 | 简报/仪表盘 (50) | 深色/暗色系 (1) | 克莱因蓝 (26) |
| 极简主义 | 开题/综述 | 极简主义 (2) | 高级灰 (20) | 黑白 (20) |

#### 布局规则

布局不是固定模板，而是根据页面类型和内容自动选择：

```typescript
type PageType = "cover" | "section" | "content" | "data" | "comparison" | "closing";

interface LayoutRule {
  pageType: PageType;
  layoutId: string;
  constraints: {
    maxBulletPoints: number;
    imagePosition: "left" | "right" | "top" | "background" | "center" | "none";
    imageRatio: number;               // 图片占页面面积比例 0-1
    textColumns: 1 | 2;
    whiteSpaceRatio: number;          // 留白比例 0-1
  };
}
```

各页面类型的布局策略：

| 页面类型 | 布局特征 | 图片策略 |
|----------|---------|---------|
| **cover** | 大留白，标题居中，装饰性背景图 | T2I 生成主题背景图，低透明度叠底 |
| **section** | 章节号 + 标题 + 3-5 条导览要点 | 小型装饰图或图标 |
| **content** | 低留白（15-30%），正文要点区 3-5 条 | 左图右文 / 右图左文 / 无图 |
| **data** | 低留白，大数字/KPI + 解释短句 | T2I 生成数据可视化配图 |
| **comparison** | 双栏或多栏对比 | 对比图/流程图 T2I 生成 |
| **closing** | 大留白，标题 + 可选 CTA | 装饰性收尾图 |

#### 图片策略

每页的图片需求由 `ImageIntentDetector` 自动判断（见第 15 节），生成 `AssetPlan`：

```typescript
interface AssetPlan {
  slideId: string;
  assets: AssetSlot[];
}

interface AssetSlot {
  slotId: string;
  slotType: "hero" | "supporting" | "icon" | "background" | "chart";
  position: "full_bleed" | "left_half" | "right_half" | "top_third" | "center" | "corner";
  sizeHint: string;                 // "16:9" | "4:3" | "1:1" | "wide_banner"
  promptStrategy: PromptStrategy;
  required: boolean;
}

interface PromptStrategy {
  basePrompt: string;               // 基础描述
  styleInjection: string;           // 从 style_spec 注入的风格描述
  contentAnchors: string[];         // 从页面内容提取的关键视觉锚点
  negativePrompt: string;           // 排除项
  aspectRatio: keyof typeof SENSENOVA_IMAGE_SIZES;
  quality: "draft" | "standard" | "high";
}
```

### 14.4 PptxRenderer 升级

现有 `PptxRenderer`（`artifact-factory/pptx-renderer.ts`）只有 2 个主题和基础文字/要点布局，需要升级：

#### 升级点 1：多主题支持

从硬编码 2 主题 → 动态 `StyleTriple` 驱动：

```typescript
const BRAND_THEMES: Record<string, BrandTheme> = {
  academic_navy: { ... },           // 保留现有
  paper_white: { ... },             // 保留现有
  // 新增：从 StyleTriple 动态生成
};

function themeFromStyleTriple(triple: StyleTriple): BrandTheme {
  return {
    background: triple.colorTone.id <= 5 ? "FFFFFF" : "0D1B2F",
    accent: triple.palette.accent,
    text: triple.colorTone.id <= 5 ? "0D1B2F" : "FFFFFF",
    contentBackground: triple.colorTone.id <= 5 ? "F8F7F2" : "1A2332",
    headingColor: triple.palette.primary,
    bodyColor: triple.colorTone.id <= 5 ? "333333" : "E0E0E0",
    headingFont: triple.typography.headingFont,
    bodyFont: triple.typography.bodyFont,
  };
}
```

#### 升级点 2：图片占位符实现

现有 `SlideInputSchema` 已有 `image_placeholder` 类型但未实现渲染：

```typescript
// 现有 schema 已定义但 renderer 未处理
type: z.enum(["text", "bullet_list", "image_placeholder", "table_placeholder"])
```

升级 `PptxRenderer` 支持图片：

```typescript
if (block.type === "image_placeholder" && block.imageUrl) {
  slide.addImage({
    path: block.imageUrl,
    x: layout.imageX,
    y: layout.imageY,
    w: layout.imageW,
    h: layout.imageH,
  });
}
```

#### 升级点 3：多布局支持

现有只支持 `title` / `content` / `two_column` / `image_focus` / `blank`，增加：

```typescript
type LayoutType =
  | "title"           // 封面页
  | "content"         // 标准内容页
  | "two_column"      // 双栏
  | "image_focus"     // 图片为主
  | "comparison"      // 对比页（新增）
  | "data_highlight"  // 数据强调页（新增）
  | "section"         // 章节过渡页（新增）
  | "closing"         // 结尾页（新增）
  | "blank";          // 空白页
```

#### 升级点 4：与 sn-ppt-standard pipeline 对接

Standard 模式的完整流程走 `sn-ppt-standard` skill pipeline：

```
Agent 生成 outline → sn-ppt-standard style → sn-ppt-standard asset-plan
→ SenseNova T2I gen-image → sn-ppt-standard page-html → sn-ppt-standard export PPTX
```

`PptxRenderer` 作为 fallback 和轻量导出路径（不依赖 Playwright 时使用）。

### 14.5 Creative 模式 T2I 流程

Creative 模式完全复用 `sn-ppt-creative` skill pipeline：

```
1. style_spec.md — LLM 根据用户 query + 文档摘要生成视觉风格指南
2. outline.json — LLM 生成页面大纲（每页的标题、要点、构图指令）
3. page_prompt.txt — LLM 为每页生成 T2I prompt（融入 style_spec）
4. sanitize_prompt.py — 清洗 prompt 中的 hex/rgb/css 等数值
5. sn-image-base T2I — 生成 16:9 全页 PNG
6. build_pptx.py — 打包成 PPTX
```

**关键：Creative 模式的 prompt 生成是核心质量决定因素。**

现有 `style_from_query.md` prompt 已经非常成熟：
- 先从内容提炼"主题语义"，再决定视觉
- 10 个基础维度（插画风格、构图、线条、几何化、空间透视、装饰元素、配色、背景、字体排版、整体氛围）
- 6 个增强章节（Theme Profile、Visual Axes、Global Visual System、Page-Type Adaptation、Sparse-Content Expansion Rules、Do/Don't）
- 硬约束：禁止 hex 色值、禁止字号数值单位、默认明亮通透

**知序场景增强**：在 `style_from_query.md` 的基础上，为学术场景增加专用指引：

```
## 学术场景增强指引

当场景为"课程汇报"或"组会论文汇报"时：
- 优先选择学术严谨、极简主义、信息图表、简约大气风格
- 配色以冷色调为主，避免过度花哨
- 内容页和数据页必须有可读文字区域，不能被装饰占满
- 图表和对比矩阵需要清晰的视觉层级
- 封面要有"学术感"而非"商业发布会感"
- 每页底部保留引用来源标注空间
```

---

## 15. 智能图片生成意图识别

### 15.1 设计目标

用户不应该手动决定"这里要不要生成图片"。Agent 应该自动判断：
1. 这页需不需要图片
2. 需要什么类型的图片
3. 图片应该放在什么位置
4. 图片 prompt 应该怎么写
5. 生成后图片质量是否达标

### 15.2 ImageIntentDetector

```typescript
interface ImageIntent {
  slideId: string;
  needsImage: boolean;
  confidence: number;                // 0-1
  slots: ImageSlotIntent[];
  reasoning: string;
}

interface ImageSlotIntent {
  slotType: "hero" | "supporting" | "icon" | "background" | "chart";
  triggerReason: ImageTriggerReason;
  promptStrategy: PromptStrategy;
  required: boolean;
  fallbackIfFailed: "skip" | "placeholder_text" | "redesign_layout";
}

type ImageTriggerReason =
  | "cover_needs_visual_anchor"       // 封面必须有视觉锚点
  | "concept_benefits_from_visual"    // 抽象概念适合配图
  | "data_needs_chart"               // 数据需要可视化
  | "comparison_needs_diagram"       // 对比需要图示
  | "process_needs_flowchart"        // 流程需要流程图
  | "method_needs_architecture"      // 方法需要架构图
  | "result_needs_visualization"     // 实验结果需要可视化
  | "section_needs_transition_visual" // 过渡页需要视觉过渡
  | "closing_needs_thematic_close"   // 结尾需要主题收尾
  | "text_heavy_needs_relief"        // 文字过多需要视觉缓解
  | "source_figure_available"        // 来源资料中有可用图表
  | "user_explicitly_requested";     // 用户明确要求
```

### 15.3 判断规则

ImageIntentDetector 基于以下信号综合判断：

#### 信号 1：页面类型

| 页面类型 | 是否需要图片 | 图片类型 | 优先级 |
|----------|------------|---------|--------|
| cover | **必须** | hero / background | P0 |
| section | 推荐 | icon / supporting | P2 |
| content | 视内容而定 | supporting / hero | P1 |
| data | **必须** | chart / hero | P0 |
| comparison | **推荐** | chart / supporting | P1 |
| closing | 推荐 | background / supporting | P2 |

#### 信号 2：内容语义

Agent 分析每页内容，识别以下语义模式：

```typescript
interface ContentSemanticSignals {
  hasAbstractConcept: boolean;       // "注意力机制"、"梯度消失"等抽象概念
  hasProcessOrFlow: boolean;         // "首先...然后...最后..."流程描述
  hasComparison: boolean;            // "相比...改进了..."对比描述
  hasDataOrMetrics: boolean;         // "准确率 95.3%"、"F1 score 0.87"
  hasArchitectureOrFramework: boolean; // "模型架构"、"系统框架"
  hasExperimentResult: boolean;      // "实验表明"、"消融实验"
  hasSourceFigure: boolean;          // 来源资料中有图表引用
  textDensity: "low" | "medium" | "high";  // 文字密度
}
```

判断逻辑：

| 语义信号 | 触发图片类型 | 示例 |
|----------|------------|------|
| `hasAbstractConcept` | supporting — 概念示意图 | "Transformer 的自注意力机制" → 生成注意力机制示意图 |
| `hasProcessOrFlow` | chart — 流程图 | "数据预处理→特征提取→模型训练→评估" → 流程图 |
| `hasComparison` | chart — 对比图 | "方法 A vs 方法 B" → 对比柱状图 |
| `hasDataOrMetrics` | chart — 数据图 | "准确率 95.3%" → 数据可视化 |
| `hasArchitectureOrFramework` | chart — 架构图 | "ResNet 网络结构" → 架构图 |
| `hasExperimentResult` | chart — 结果图 | "消融实验结果" → 结果可视化 |
| `hasSourceFigure` | supporting — 来源图 | "如图 3 所示" → 提取来源图表或重绘 |
| `textDensity == "high"` | supporting — 视觉缓解 | 文字过多页面 → 配图缓解视觉疲劳 |

#### 信号 3：来源资料中的图表

当解析的来源资料中包含图表时（Docling/GROBID 可提取图表位置和描述），优先使用来源图表：

```typescript
interface SourceFigureSignal {
  sourceId: string;
  figureIndex: number;
  caption: string;
  pageNumber: number;
  figureType: "chart" | "diagram" | "photo" | "table" | "equation";
  extractable: boolean;              // 是否可以提取为独立图片
  relevanceToSlide: number;          // 与当前页面的相关性 0-1
}
```

处理策略：
1. **可提取且高相关** → 直接使用来源图表，不调用 T2I
2. **可提取但需重绘** → 用来源图表描述生成 T2I prompt，重新绘制更清晰的版本
3. **不可提取** → 用图表描述生成 T2I prompt，生成替代图

#### 信号 4：用户偏好

从对话历史中识别用户的图片偏好：

```typescript
interface UserImagePreference {
  prefersVisualHeavy: boolean;       // 用户喜欢多图
  prefersMinimal: boolean;           // 用户喜欢极简
  explicitlyRequestedImages: string[]; // 用户明确要求生成图片的描述
  previouslyRejectedImages: string[]; // 用户之前拒绝的图片类型
}
```

### 15.4 Prompt 生成策略

图片质量 80% 取决于 prompt 质量。知序的 prompt 生成不是简单地把页面标题丢给 T2I，而是分层构建：

#### 层次 1：内容锚点提取

从页面内容中提取关键视觉锚点：

```typescript
function extractVisualAnchors(slideContent: SlidePlan): string[] {
  const anchors: string[] = [];
  
  // 从标题提取主题
  anchors.push(slideContent.title);
  
  // 从要点提取关键对象
  for (const point of slideContent.keyPoints) {
    // 识别可视觉化的名词短语
    // "Transformer 架构" → "transformer architecture diagram"
    // "梯度下降过程" → "gradient descent optimization visualization"
    // "对比实验结果" → "comparison bar chart"
  }
  
  return anchors;
}
```

#### 层次 2：风格注入

从 style_spec 注入视觉风格描述：

```typescript
function injectStyleToPrompt(basePrompt: string, styleSpec: StyleTriple): string {
  // 注入设计风格关键词
  // "学术严谨" → "clean academic layout, serif typography, structured grid, muted professional palette"
  // "科技感" → "futuristic tech visualization, glowing data lines, dark background, neon accents"
  
  // 注入配色
  // primary: #1A5276 → "deep sapphire blue as primary color"
  
  // 注入构图
  // "content page" → "left-aligned text block with right-side illustration, clear hierarchy"
  
  return enhancedPrompt;
}
```

#### 层次 3：场景专用 prompt 模板

为知序的核心场景预置 prompt 模板：

```typescript
const SCENE_PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  // 论文方法架构图
  paper_method_architecture: {
    template: "A clean architectural diagram of {method_name}, showing {components} and their connections. Academic style, white/light gray background, blue accent lines, clear labels, structured layout suitable for research presentation.",
    variables: ["method_name", "components"],
    negativePrompt: "photograph, 3D render, cartoon, messy handwriting, dark background, neon colors",
  },
  
  // 实验结果对比
  experiment_comparison: {
    template: "A professional comparison chart showing {metrics} across {methods}. Clean data visualization style, bar chart format, {primary_color} accent, clear axis labels, academic presentation quality.",
    variables: ["metrics", "methods", "primary_color"],
    negativePrompt: "photograph, illustration, cartoon, messy, dark background",
  },
  
  // 研究背景概念图
  research_background: {
    template: "An abstract conceptual illustration representing {concept}, {style_description}. Clean, professional, suitable for academic presentation, {color_tone} palette.",
    variables: ["concept", "style_description", "color_tone"],
    negativePrompt: "text-heavy, messy, cartoon, low quality, watermark",
  },
  
  // 封面背景
  cover_background: {
    template: "A visually striking cover background for a presentation about {topic}, {style_description}. {color_tone} palette, elegant composition, space for title overlay, professional academic feel.",
    variables: ["topic", "style_description", "color_tone"],
    negativePrompt: "text, words, letters, watermark, low quality, blurry",
  },
  
  // 流程图
  process_flow: {
    template: "A clean flowchart showing the process of {process_name}, with steps: {steps}. Professional diagram style, {primary_color} accent, clear arrows and labels, white background, academic presentation quality.",
    variables: ["process_name", "steps", "primary_color"],
    negativePrompt: "photograph, 3D, cartoon, messy, dark background",
  },
};
```

#### 层次 4：Prompt 质量保障

复用 `sn-ppt-creative/scripts/sanitize_prompt.py` 的清洗逻辑：

- 移除 hex 色值（`#RRGGBB`）
- 移除 CSS 数值（`px`, `em`, `rem`, `pt`）
- 移除 JSON/YAML 代码片段
- 确保 prompt 是自然语言描述

### 15.5 图片生成与验证流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    图片生成完整流程                               │
│                                                                  │
│  1. ImageIntentDetector                                          │
│     分析页面内容 → 判断是否需要图片 → 确定图片类型和位置          │
│                                                                  │
│  2. PromptComposer                                               │
│     内容锚点 + 风格注入 + 场景模板 → 生成 T2I prompt             │
│                                                                  │
│  3. PromptSanitizer                                              │
│     清洗 hex/css/数值 → 纯自然语言 prompt                        │
│                                                                  │
│  4. SenseNova T2I                                                │
│     调用 generateImage() → 获取图片 URL                          │
│                                                                  │
│  5. ImageVerifier (可选)                                         │
│     调用 recognizeImage() → 检查图片是否与 prompt 匹配            │
│     不匹配 → 重新生成（最多 1 次）                                │
│                                                                  │
│  6. AssetBinding                                                 │
│     图片 URL 绑定到 SlidePlan 的对应 slot                        │
│     更新 Canvas 展示                                             │
│                                                                  │
│  7. Fallback                                                     │
│     生成失败 → 根据 fallbackIfFailed 策略处理                    │
│     skip: 跳过该图片，调整布局                                   │
│     placeholder_text: 用文字描述替代                              │
│     redesign_layout: 重新设计无图布局                             │
└─────────────────────────────────────────────────────────────────┘
```

### 15.6 与 Agent Canvas Workspace 的集成

在 Agent Canvas Workspace 中，图片生成是 Agent 后台推进的一部分：

```
用户选择 A/B/C 方案
    │
    ▼
Agent 生成页级大纲（Canvas 展示）
    │
    ▼
Agent 分析每页图片需求（ImageIntentDetector）
    │
    ▼
对话区显示进度：
"正在为第 3 页生成方法架构图..."
"正在为第 5 页生成实验对比图..."
    │
    ▼
Canvas 同步更新：
每张图片生成后立即出现在对应页面位置
    │
    ▼
Agent Inspector 显示：
- 图片来源：AI 生成
- 生成 prompt：xxx
- 基于内容：第 3 页方法描述
- 风格：学术严谨
- 操作：重新生成 / 替换 / 删除
```

用户可以在 Canvas 中对任何图片执行：
- **重新生成**：修改 prompt 后重新调用 T2I
- **替换**：上传自己的图片
- **删除**：移除图片，自动调整布局
- **从来源提取**：如果来源资料有对应图表，优先使用

### 15.7 成本控制

图片生成是高成本操作，需要控制：

```typescript
interface ImageQuota {
  maxImagesPerPresentation: number;  // 默认 8
  maxImagesPerSlide: number;         // 默认 1
  qualityDefault: "draft" | "standard" | "high";  // 默认 "standard"
  enableVerification: boolean;       // 默认 false（验证会额外消耗一次 VLM 调用）
  maxRetries: number;                // 默认 1
}
```

策略：
- 封面和关键数据页优先分配图片配额
- draft 模式下使用低分辨率快速生成预览
- 用户确认大纲后再用 standard/high 质量重新生成
- 来源资料有可用图表时优先使用，不调用 T2I

---

## 16. 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| Docling/GROBID 本地部署复杂 | 论文解析质量受限 | 第一阶段先用 MarkItDown + LLM 补全，Docling/GROBID 作为增强 |
| LLM 生成内容引用不准 | 用户信任度下降 | 三色溯源 + Evidence 绑定 + Human Gate 强制确认灰色内容 |
| Canvas 实时更新性能 | 用户体验卡顿 | CanvasPatch 增量更新 + 节流渲染 |
| A/B/C 决策卡选择后回退 | 用户改主意 | 支持回退到决策点重新选择，Canvas 状态回滚 |
| 多论文解析时间过长 | 用户等待焦虑 | 进度条 + 分步展示（先出第一篇 Paper Card，再逐步补充） |
| T2I 图片与内容不匹配 | PPT 质量下降 | ImageVerifier 可选验证 + 用户 Canvas 内一键重新生成 |
| T2I 生成失败或超时 | 页面缺图 | fallbackIfFailed 策略（skip / placeholder_text / redesign_layout），不阻塞流程 |
| Creative 模式文字不可编辑 | 用户后续修改困难 | 默认推荐 Standard 模式，Creative 模式需用户主动选择或在 A/B/C 卡中明确提示 |
| 图片生成成本过高 | 用户配额消耗快 | ImageQuota 控制 + 来源图表优先 + draft 预览模式 |
| sn-ppt-standard 依赖 Playwright | 部署环境限制 | PptxRenderer 作为 fallback 导出路径，HTML 页面作为备选交付物 |
| style_catalog 风格选择不准 | 视觉与内容不匹配 | 知序场景预设推荐 + 用户可在 Canvas 中切换风格 |
