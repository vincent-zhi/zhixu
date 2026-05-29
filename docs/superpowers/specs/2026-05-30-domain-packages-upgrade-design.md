# 知序领域功能包全面升级设计文档

日期：2026-05-30

## 1. 目标

将 `@zhixu/undergrad`、`@zhixu/grad`、`@zhixu/research`、`@zhixu/coaching`、`@zhixu/efficiency` 五个领域功能包从独立的纯函数库升级为接入知序系统的 LLM 增强领域服务。

## 2. 当前状态

所有 5 个包已有完整实现（26 个类、69 个方法、107 个测试用例），但存在以下问题：

| 问题 | 说明 |
|------|------|
| 未接入 Server API | 无 Fastify 路由调用这些包 |
| 未接入 Web UI | 前端页面不使用这些包的功能 |
| 纯关键词逻辑 | 所有分析基于 regex/关键词/词频，无 LLM 调用 |
| 未使用 @zhixu/core | package.json 声明了依赖但无 import |
| 无数据持久化 | 结果不存入数据库 |
| 未注册为 Skills | 不在 Skill Registry 中 |

## 3. 统一升级架构

所有 5 个包遵循相同的五层升级模式：

```
Web UI (page.tsx)
    ↓ api-client.ts 新增函数
Server API routes (app.ts 新增路由)
    ↓ 调用 LLM-Enhanced Service
LLM-Enhanced Service Layer (新增 per-package service)
    ↓ 调用 model-gateway + 现有包方法
Domain Package (现有 + 新增 enhanced 方法)
    ↓
DB Persistence (PrismaProjectStore 扩展，存入 Project/Task/Artifact)
```

### 3.1 LLM 增强策略

- **保留现有 heuristic 方法**作为 `fallback`（无 LLM 配置时自动降级）
- **新增 `*Enhanced` 方法**：先调 LLM，失败时 fallback 到 heuristic
- **LLM 调用路径**：server 路由通过 `createLLMModelGateway(store, config)` 获取 gateway 实例（已在 `apps/server/src/model-gateway.ts` 中定义），gateway 内部使用 `@zhixu/model-gateway` 的 `LLMClient.chat()` 方法。若 gateway 为 `MockModelGateway`（未配置 API Key），则所有 `*Enhanced` 方法自动降级到 heuristic。
- **责任标记**：LLM 生成的内容自动标记为 `yellow`（需核验），heuristic 结果标记为 `green`（可溯源）
- **HumanGate**：高风险输出（审稿回复 L3、基金分析 L3、考试预测 L2）在路由处理函数中调用 `store.createHumanGate()` 创建确认门控，前端必须展示确认弹窗后才能继续

### 3.2 DB 持久化策略

不新增 Prisma 模型，利用现有结构：

| 数据类型 | 存储位置 |
|----------|---------|
| 各包的中间状态 | `Project.currentState` JSON 字段 |
| 结构化任务输出 | `Task` 模型（assigneeType = ai_human） |
| 产物输出 | `Artifact` + `ArtifactBlock`（responsibilityColor） |
| 证据链 | `Evidence` 模型（sourceId, blockId） |
| 导师偏好 | `MentorFeedback` + `KnowledgeCapsule` |

### 3.3 Skill 注册策略

所有新功能注册为内置 Skills，在 `apps/server/src/skill-registry.ts` 中注册：

| Skill ID | 来源包 | 风险等级 | HumanGate |
|----------|--------|---------|-----------|
| skill_defense_sim | coaching | L2 | 是 |
| skill_socratic_coach | coaching | L1 | 否 |
| skill_meeting_brief | coaching | L1 | 否 |
| skill_diagnostic | coaching | L1 | 否 |
| skill_procrastination | coaching | L0 | 否 |
| skill_submission_check | grad | L2 | 是 |
| skill_review_response | grad | L3 | 是 |
| skill_experiment_log | grad | L2 | 是 |
| skill_grant_analysis | grad | L3 | 是 |
| skill_research_gaps | grad | L2 | 是 |
| skill_citation_fix | grad | L1 | 否 |
| skill_paper_read | research | L1 | 否 |
| skill_paper_compare | research | L1 | 否 |
| skill_semester_plan | undergrad | L1 | 否 |
| skill_class_notes | undergrad | L1 | 否 |
| skill_self_check | undergrad | L1 | 否 |
| skill_exam_crash | undergrad | L2 | 是 |
| skill_ppt_beautify | undergrad | L0 | 否 |
| skill_group_divide | undergrad | L1 | 否 |
| skill_termbase | efficiency | L0 | 否 |
| skill_style_unify | efficiency | L1 | 否 |
| skill_deduplicate | efficiency | L0 | 否 |
| skill_format_convert | efficiency | L0 | 否 |
| skill_cross_project | efficiency | L1 | 否 |
| skill_fragment_collect | efficiency | L0 | 否 |

---

## 4. 包详细设计

### 4.1 @zhixu/coaching — 学业教练

#### 4.1.1 DefenseSimulator 升级

**现有**：模板题库 + 关键词评分
**升级后**：

```typescript
// 新增方法
class DefenseSimulator {
  // 现有方法保留
  generateQuestions(template: PaperTemplate): DefenseQuestion[]
  evaluateAnswer(question: DefenseQuestion, answer: string): DefensePerformance
  runSimulation(questions: DefenseQuestion[], answers: string[]): DefenseSimulation

  // 新增 LLM 增强方法
  async generateQuestionsFromPaper(
    paperContent: string,
    llm: LLMClient
  ): Promise<DefenseQuestion[]>
  // - 用 LLM 分析论文内容，生成针对性答辩问题
  // - 覆盖：方法论、实验设计、结果解读、贡献声明、局限性、相关工作
  // - 每个问题附带评分标准（rubric）
  // - fallback: 现有 generateQuestions()

  async evaluateAnswerWithRubric(
    question: DefenseQuestion,
    answer: string,
    rubric: string[],
    llm: LLMClient
  ): Promise<DefensePerformance>
  // - 用 LLM 基于 rubric 评估答案质量
  // - 返回：score, strengths[], weaknesses[], improvement_suggestions[]
  // - fallback: 现有 evaluateAnswer()
}
```

#### 4.1.2 SocraticCoach 升级

```typescript
class SocraticCoach {
  // 现有保留
  generateQuestions(topic: string, depth: number): SocraticQuestion[]
  followUp(category: string, concept: string): SocraticQuestion

  // 新增
  async generateContextualQuestions(
    conversationHistory: string[],
    projectContext: { title: string; type: string; sources: string[] },
    llm: LLMClient
  ): Promise<SocraticQuestion[]>
  // - 基于对话历史和项目上下文生成苏格拉底式追问
  // - 避免重复已问过的问题
  // - 追问逻辑：浅层理解 → 深层假设 → 反面论证 → 实际应用
}
```

#### 4.1.3 MeetingBriefer 升级

```typescript
class MeetingBriefer {
  // 现有保留
  generateBrief(type: MeetingType, recentProgress: string[], upcomingDeadlines: string[]): MeetingBrief

  // 新增
  async generateProjectBrief(
    project: ProjectDetail,
    llm: LLMClient
  ): Promise<MeetingBrief>
  // - 从项目实际数据（sources, tasks, artifacts, evidence）生成组会简报
  // - 输出：key_points, slide_suggestions, anticipated_questions, checklist
  // - anticipated_questions 基于导师历史反馈和项目风险
}
```

#### 4.1.4 DiagnosticEngine 升级

```typescript
class DiagnosticEngine {
  // 现有保留
  generateReport(tasks: TaskSummary[], artifacts: ArtifactSummary[]): DiagnosticReport

  // 新增
  async generateInsightReport(
    project: ProjectDetail,
    llm: LLMClient
  ): Promise<DiagnosticReport & { aiInsights: string[] }>
  // - 先用现有方法生成统计数据
  // - 再用 LLM 分析数据，生成改进建议
  // - aiInsights: 具体可行的改进措施
}
```

#### 4.1.5 ProcrastinationAdapter

保持现有逻辑，不加 LLM。原因是拖延适配是轻量级本地逻辑，不需要 LLM。

#### 4.1.6 API 路由

```typescript
// apps/server/src/app.ts 新增路由

// 答辩模拟
fastify.post('/api/projects/:projectId/coaching/defense/start', async (req, reply) => {
  // 输入：{ paperContent?: string, template?: object }
  // 输出：DefenseSimulation with questions[]
  // 如果有 paperContent，用 LLM 增强版；否则用模板版
  // 创建 HumanGate（L2 风险）
})

fastify.post('/api/projects/:projectId/coaching/defense/answer', async (req, reply) => {
  // 输入：{ questionId: string, answer: string }
  // 输出：DefensePerformance with score, feedback
})

// 苏格拉底式追问
fastify.post('/api/projects/:projectId/coaching/socratic', async (req, reply) => {
  // 输入：{ topic: string, depth?: number, conversationHistory?: string[] }
  // 输出：SocraticQuestion[]
})

// 组会简报
fastify.post('/api/projects/:projectId/coaching/meeting-brief', async (req, reply) => {
  // 输入：{ type: 'group_meeting' | 'advising' | 'defense_prep' | 'progress_update' }
  // 输出：MeetingBrief
  // 自动从 project 数据生成
})

// 学业诊断
fastify.post('/api/projects/:projectId/coaching/diagnostic', async (req, reply) => {
  // 输出：DiagnosticReport with aiInsights
})

// 拖延适配
fastify.post('/api/projects/:projectId/coaching/procrastination', async (req, reply) => {
  // 输入：{ taskId: string, delayDays: number }
  // 输出：ProcrastinationAdapter result with microTasks
})
```

#### 4.1.7 UI 集成

在 `/projects/[id]` 页面（`apps/web/app/projects/[id]/page.tsx`）扩展：

- **答辩模拟面板**：点击"Simulate Defense"后弹出侧边面板，显示问题列表、答题区、评分结果
- **诊断报告**：新增 Quick Action "学业诊断"，点击后显示诊断面板
- **组会简报**：新增 Quick Action "生成组会简报"，选择类型后显示简报内容
- **苏格拉底追问**：在 AI 对话页面集成，用户可对某个话题发起苏格拉底式追问

---

### 4.2 @zhixu/grad — 硕博工具

#### 4.2.1 SubmissionChecker 升级

```typescript
class SubmissionChecker {
  // 现有保留
  checkSubmission(content: string, venue: 'IEEE' | 'ACM' | 'Nature'): SubmissionChecklist

  // 新增
  async checkSubmissionEnhanced(
    content: string,
    venue: string,
    customRequirements?: string[],
    llm: LLMClient
  ): Promise<SubmissionChecklist & { aiAnalysis: string[] }>
  // - 先用现有方法做基础检查
  // - 再用 LLM 逐项分析：摘要字数、参考文献格式、图表规范、补充材料
  // - 支持自定义 venue 要求（从用户上传的 CFP/投稿指南解析）
  // - aiAnalysis: 详细的修改建议
}
```

#### 4.2.2 ReviewResponseEngine 升级

```typescript
class ReviewResponseEngine {
  // 现有保留
  parseReviewComments(rawReview: string): ReviewComment[]
  generateActionItems(comments: ReviewComment[]): ReviewActionItem[]
  draftResponseLetter(actionItems: ReviewActionItem[]): ResponseLetterSection[]
  createReviewResponse(rawReview: string): ReviewResponse

  // 新增
  async createReviewResponseEnhanced(
    rawReview: string,
    paperContent: string,
    llm: LLMClient
  ): Promise<ReviewResponse & { aiDraftSections: ResponseLetterSection[] }>
  // - 用 LLM 理解审稿意见的真实意图（不是关键词匹配）
  // - 基于论文内容生成针对性回复（引用具体段落/实验）
  // - 生成 Response Letter 草稿：逐条回复 + 修改说明 + 修改位置引用
  // - 标记每条回复的 confidence 和 evidence
}
```

#### 4.2.3 ExperimentLogManager 升级

```typescript
class ExperimentLogManager {
  // 现有保留
  createLog(partial: Partial<ExperimentLog>): ExperimentLog
  analyzeAnomaly(log: ExperimentLog): ExperimentAnomaly
  standardizeLog(log: ExperimentLog): ExperimentLog

  // 新增
  async analyzeAnomalyEnhanced(
    log: ExperimentLog,
    llm: LLMClient
  ): Promise<ExperimentAnomaly & { hypotheses: string[]; nextSteps: string[] }>
  // - 用 LLM 基于变量、步骤、环境、结果生成归因假设
  // - 输出排查优先级和对照实验建议
  // - hypotheses: 排序的归因假设列表
  // - nextSteps: 具体的排查步骤
}
```

#### 4.2.4 GrantApplicationHelper 升级

```typescript
class GrantApplicationHelper {
  // 现有保留
  analyzeGrant(application: GrantApplication): { logicGaps: string[]; evidenceGaps: string[]; completeness: number }

  // 新增
  async analyzeGrantEnhanced(
    application: GrantApplication,
    llm: LLMClient
  ): Promise<{ logicGaps: string[]; evidenceGaps: string[]; completeness: number; aiReview: string[] }>
  // - 用 LLM 评估：研究背景是否充分、创新点是否清晰、技术路线是否可行
  // - 检查逻辑连贯性和证据缺口
  // - aiReview: 详细的修改建议（按 section 组织）
}
```

#### 4.2.5 ResearchGapAnalyzer 升级

```typescript
class ResearchGapAnalyzer {
  // 现有保留
  analyzeGaps(papers: string[]): ResearchGap[]
  scoreGap(gap: ResearchGap): number

  // 新增
  async analyzeGapsEnhanced(
    papers: string[],
    llm: LLMClient
  ): Promise<ResearchGap & { aiDirections: Array<{ direction: string; rationale: string; feasibility: number }> }>
  // - 用 LLM 综合多篇论文的 limitations 和 future work
  // - 生成候选研究方向，附带文献证据、可行性和所需实验
}
```

#### 4.2.6 AcademicTracker / AcademicResumeBuilder / CitationFixer

- **AcademicTracker**：保持现有逻辑，不加 LLM（关键词匹配已足够做订阅推送）
- **AcademicResumeBuilder**：保持现有逻辑（场景排序是确定性规则）
- **CitationFixer**：保持格式化逻辑，新增 LLM 补全缺失元数据（title, authors, DOI）

#### 4.2.7 API 路由

```typescript
// 投稿检查
fastify.post('/api/projects/:id/grad/submission-check', ...)
// - 输入：{ venue: string, content?: string, customRequirements?: string[] }
// - 创建 HumanGate (L2)

// 审稿回复
fastify.post('/api/projects/:id/grad/review-response', ...)
// - 输入：{ rawReview: string, paperContent?: string }
// - 创建 HumanGate (L3)

// 实验日志
fastify.post('/api/projects/:id/grad/experiment-log', ...)
// - 输入：{ log: ExperimentLog }
// - 创建 HumanGate (L2)

// 基金分析
fastify.post('/api/projects/:id/grad/grant-analysis', ...)
// - 输入：{ application: GrantApplication }
// - 创建 HumanGate (L3)

// 研究空白
fastify.post('/api/projects/:id/grad/research-gaps', ...)
// - 输入：{ paperIds?: string[] }
// - 创建 HumanGate (L2)

// 引用修复
fastify.post('/api/projects/:id/grad/citation-fix', ...)
// - 输入：{ citations: string[], style: 'APA' | 'IEEE' | 'GB-T7714' }
```

#### 4.2.8 UI 集成

在 `/projects/[id]` 页面扩展：

- **审稿回复**：Quick Action "审稿意见整改"，上传审稿意见后显示分析和回复草稿
- **投稿检查**：Quick Action "投稿预检"，选择 venue 后显示检查报告
- **引用修复**：在 Studio 编辑器中集成，右侧面板新增"引用修复"按钮
- **研究空白**：在 Knowledge 页面集成，论文阅读后显示研究空白分析

---

### 4.3 @zhixu/research — 论文阅读

#### 4.3.1 PaperReader 升级

```typescript
class PaperReader {
  // 现有保留
  readPaper(content: string): PaperEntry
  comparePapers(entries: PaperEntry[]): PaperMatrix
  generateReportOutline(matrix: PaperMatrix): string[]

  // 新增
  async readPaperEnhanced(
    content: string,
    llm: LLMClient
  ): Promise<PaperEntry>
  // - 用 LLM 深度分析论文内容
  // - 提取：research_question, background_motivation, methodology, dataset,
  //   experimental_setup, results, contributions, limitations, reproducibility
  // - 每个字段附带 evidence_anchor（页码/段落引用）
  // - fallback: 现有 readPaper()

  async comparePapersEnhanced(
    entries: PaperEntry[],
    llm: LLMClient
  ): Promise<PaperMatrix & {
    methodClassification: Array<{ category: string; papers: string[] }>;
    controversies: Array<{ topic: string; positions: string[] }>;
    researchGaps: string[];
    suggestedOutline: string[];
  }>
  // - 用 LLM 识别：方法分类、争议点、研究空白
  // - 生成组会汇报大纲建议
}
```

#### 4.3.2 API 路由修改

现有 app.ts 中的 paper/read、paper/compare、paper/matrix 路由**直接调用 LLM**，未使用 `@zhixu/research` 包。需要修改为：

```typescript
// 修改现有路由，改为调用 @zhixu/research 包 + LLM 增强
fastify.post('/api/projects/:projectId/paper/read', async (req, reply) => {
  // 之前：直接调用 LLM
  // 之后：调用 research.PaperReader.readPaperEnhanced(content, llm)
  // 结果存入 Artifact + Evidence
})

fastify.post('/api/projects/:projectId/paper/compare', async (req, reply) => {
  // 之前：直接调用 LLM
  // 之后：调用 research.PaperReader.comparePapersEnhanced(entries, llm)
})

fastify.post('/api/projects/:projectId/paper/matrix', async (req, reply) => {
  // 之前：直接调用 LLM
  // 之后：调用 research.PaperReader.comparePapersEnhanced(entries, llm) 的子集
})
```

#### 4.3.3 UI 集成

已存在于 `/knowledge` 页面的论文阅读区域，需确保调用新 API 并展示增强数据（方法分类、争议点、研究空白）。

---

### 4.4 @zhixu/undergrad — 本科工具

#### 4.4.1 SemesterPlanner 升级

```typescript
class SemesterPlanner {
  // 现有保留
  createPlan(courses: CourseEntry[], semesterStart: string, semesterEnd: string): SemesterPlan
  adjustForExamWeek(plan: SemesterPlan, examWeekStart: string): SemesterPlan

  // 新增
  async createPlanEnhanced(
    courses: CourseEntry[],
    semesterStart: string,
    semesterEnd: string,
    llm: LLMClient
  ): Promise<SemesterPlan & { aiStrategy: string; aiTips: string[] }>
  // - 用 LLM 基于课程难度、考核方式、学分数生成个性化学习策略
  // - aiStrategy: 总体策略描述
  // - aiTips: 具体到每周的学习建议
}
```

#### 4.4.2 ClassNotesProcessor 升级

```typescript
class ClassNotesProcessor {
  // 现有保留
  processTranscript(rawTranscript: string): ClassNotes
  extractActionItems(notes: ClassNotes): string[]

  // 新增
  async processTranscriptEnhanced(
    rawTranscript: string,
    courseInfo: { name: string; type: string; topics: string[] },
    llm: LLMClient
  ): Promise<ClassNotes & { aiSummary: string; examHints: string[]; keyConcepts: string[] }>
  // - 用 LLM 从录音转写中智能提炼
  // - 比关键词匹配更准确地识别考点、作业要求、重点内容
  // - aiSummary: 课程内容摘要
  // - examHints: 考试重点提示
  // - keyConcepts: 关键概念列表
}
```

#### 4.4.3 SelfChecker 升级

```typescript
class SelfChecker {
  // 现有保留
  checkArtifact(content: string, options: CheckOptions): SelfCheckResult

  // 新增
  async checkArtifactEnhanced(
    content: string,
    options: CheckOptions,
    llm: LLMClient
  ): Promise<SelfCheckResult & { aiFeedback: Array<{ section: string; issue: string; suggestion: string }> }>
  // - 先用现有方法做基础检查（字数、格式、引用、口语化）
  // - 再用 LLM 评估：逻辑连贯性、论证充分性、主题匹配度、结论合理性
  // - aiFeedback: 按段落/章节的具体修改建议
}
```

#### 4.4.4 ExamCrashPlanner 升级

```typescript
class ExamCrashPlanner {
  // 现有保留
  createCrashPlan(topics: HighFrequencyTopic[], examDate: string, dailyHours: number): ExamCrashPlan
  extractHighFrequencyTopics(sources: string[]): HighFrequencyTopic[]

  // 新增
  async extractTopicsEnhanced(
    sources: string[],
    pastExams: string[],
    llm: LLMClient
  ): Promise<HighFrequencyTopic[]>
  // - 用 LLM 分析课件+往年题，提取高频考点
  // - 比词频分析更准确地识别知识单元（而非单词）
  // - 标记每个考点的出现频率、难度、关联知识点
}
```

#### 4.4.5 PPTBeautifier / GroupDivider

- **PPTBeautifier**：保持现有逻辑（4 种检测足够），不做 LLM 增强
- **GroupDivider**：保持现有逻辑（权重分配是数学计算），不做 LLM 增强

#### 4.4.6 API 路由

```typescript
// 学期规划
fastify.post('/api/projects/:id/undergrad/semester-plan', ...)
// 输入：{ courses: CourseEntry[], semesterStart, semesterEnd }

// 课堂笔记
fastify.post('/api/projects/:id/undergrad/class-notes', ...)
// 输入：{ rawTranscript: string, courseInfo?: object }

// 作业自查
fastify.post('/api/projects/:id/undergrad/self-check', ...)
// 输入：{ content: string, options: CheckOptions }

// 期末速成
fastify.post('/api/projects/:id/undergrad/exam-crash', ...)
// 输入：{ sources: string[], pastExams?: string[], examDate, dailyHours }
// 创建 HumanGate (L2)

// PPT 美化
fastify.post('/api/projects/:id/undergrad/ppt-beautify', ...)
// 输入：{ slides: string[] }

// 小组分工
fastify.post('/api/projects/:id/undergrad/group-divide', ...)
// 输入：{ members: GroupMember[], tasks: string[], totalHours: number }
```

#### 4.4.7 UI 集成

在 `/projects/[id]` 页面扩展：

- **期末速成**：Quick Action "期末速成计划"，选择资料后显示考点和复习计划
- **作业自查**：在 Studio 编辑器中集成，右侧面板新增"自查预检"按钮
- **学期规划**：在 `/today` 页面新增"学期规划"入口

---

### 4.5 @zhixu/efficiency — 效率工具

#### 4.5.1 StyleUnifier 升级

```typescript
class StyleUnifier {
  // 现有保留
  createProfile(partial: Partial<StyleProfile>): StyleProfile
  unifyStyle(text: string, profile: StyleProfile): string
  checkConsistency(text: string, profile: StyleProfile): Array<{ type: string; position: number; suggestion: string }>

  // 新增
  async unifyStyleEnhanced(
    text: string,
    profile: StyleProfile,
    llm: LLMClient
  ): Promise<{ unified: string; changes: Array<{ original: string; replacement: string; reason: string }> }>
  // - 用 LLM 学术风格重写（而非简单正则替换）
  // - 处理：人称、时态、措辞正式度、句式多样性、中英文混排规范
  // - 返回每处修改的原因
}
```

#### 4.5.2 CrossProjectLinker 升级

```typescript
class CrossProjectLinker {
  // 现有保留
  createLink(source: string, target: string, type: string): CrossProjectLink
  findRelatedProjects(projectId: string, links: CrossProjectLink[]): string[]
  suggestLinks(projects: Array<{ id: string; title: string; type: string }>): CrossProjectLink[]

  // 新增
  async suggestLinksEnhanced(
    projects: Array<{ id: string; title: string; type: string; summary: string }>,
    llm: LLMClient
  ): Promise<Array<CrossProjectLink & { rationale: string; sharedKnowledge: string[] }>>
  // - 用 LLM 分析项目间的知识关联
  // - 不只是标题相似度，而是理解内容层面的关联
  // - 输出关联理由和共享知识点
}
```

#### 4.5.3 TermbaseManager 升级

```typescript
class TermbaseManager {
  // 现有保留
  createTermbase(name: string): Termbase
  addEntry(termbase: Termbase, entry: Omit<TermEntry, 'id' | 'createdAt'>): Termbase
  lookup(termbase: Termbase, query: string): TermEntry | undefined
  unifyTerms(text: string, termbase: Termbase): string
  exportTermbase(termbase: Termbase): string

  // 新增
  async extractTerms(
    content: string,
    llm: LLMClient
  ): Promise<Array<{ term: string; aliases: string[]; definition: string; context: string }>>
  // - 用 LLM 从文档中自动提取学术术语
  // - 识别中英文对照、缩写全称、同义词
}
```

#### 4.5.4 FragmentCollector / FormatConverter / ContentDeduplicator

- **FragmentCollector**：保持现有逻辑，仅做 API 接入
- **FormatConverter**：保持现有逻辑（纯转换无需 LLM），仅做 API 接入
- **ContentDeduplicator**：保持现有逻辑，仅做 API 接入

#### 4.5.5 API 路由

```typescript
// 术语管理
fastify.post('/api/projects/:id/efficiency/termbase', ...)
// 输入：{ action: 'create' | 'add' | 'lookup' | 'unify' | 'export' | 'extract', ... }

// 碎片笔记
fastify.post('/api/projects/:id/efficiency/fragments', ...)
// 输入：{ action: 'collect' | 'organize' | 'link', ... }

// 跨项目关联
fastify.post('/api/projects/:id/efficiency/cross-project', ...)
// 输入：{ action: 'suggest' | 'create' | 'find-related', ... }

// 风格统一
fastify.post('/api/projects/:id/efficiency/style-unify', ...)
// 输入：{ text: string, profile?: StyleProfile }

// 内容去重
fastify.post('/api/projects/:id/efficiency/deduplicate', ...)
// 输入：{ items: Array<{ id: string; content: string }>, threshold?: number }

// 格式转换
fastify.post('/api/projects/:id/efficiency/format-convert', ...)
// 输入：{ content: string, from: 'markdown' | 'html' | 'latex', to: string }
```

#### 4.5.6 UI 集成

- **术语管理**：在 `/materials` 页面新增"术语库"标签，支持从文档提取术语
- **风格统一**：在 Studio 编辑器中集成，右侧面板新增"风格统一"按钮
- **跨项目关联**：在 `/knowledge` 页面新增"跨项目知识关联"可视化

---

## 5. UI 集成模式

所有 5 个包的 UI 集成遵循统一的交互模式：

### 5.1 Quick Action 按钮模式

在 `apps/web/app/projects/[id]/page.tsx` 底部的 Quick Actions 栏新增按钮。点击后：
1. 弹出右侧面板（SlidePanel 组件）
2. 面板内显示输入表单（如有参数）
3. 提交后显示 loading 状态（带进度动画）
4. 返回结果后渲染结构化数据

### 5.2 Studio 集成模式

在 `apps/web/app/studio/[id]/page.tsx` 右侧 Inspector 面板中新增 Action 按钮。点击后：
1. 直接操作当前选中的 Block
2. 结果直接更新 Block 内容
3. 标记 responsibilityColor

### 5.3 api-client.ts 扩展

所有新 API 在 `apps/web/app/api-client.ts` 中新增对应的 typed 函数，遵循现有模式：
```typescript
export async function startDefenseSimulation(projectId: string, input: { paperContent?: string }) {
  return post(`/api/projects/${projectId}/coaching/defense/start`, input);
}
```

---

## 6. 测试策略

### 6.1 单元测试

每个包现有的 `*.test.ts` 文件扩展：

| 包 | 现有测试 | 新增测试 |
|---|---------|---------|
| coaching | ~20 | +10 (LLM 增强方法) |
| grad | ~30 | +15 (LLM 增强方法) |
| research | ~12 | +8 (LLM 增强方法) |
| undergrad | ~20 | +10 (LLM 增强方法) |
| efficiency | ~25 | +8 (LLM 增强方法) |

### 6.2 集成测试

- `apps/server/src/app.test.ts` 扩展，覆盖所有新 API 路由
- 使用 `MockModelGateway` 替代真实 LLM 调用
- 验证 HumanGate 创建、DB 持久化、响应格式

### 6.3 E2E 测试

- `apps/server/src/e2e.test.ts` 扩展
- 测试完整流程：创建项目 → 上传资料 → 调用领域功能 → 验证输出

---

## 7. 执行计划

5 个包**并行升级**，每个包由一个独立 agent 负责：

| Agent | 负责包 | 预估工作量 |
|-------|--------|-----------|
| Agent 1 | @zhixu/coaching | 6 个 API 路由 + 4 个 LLM 增强 + UI 面板 |
| Agent 2 | @zhixu/grad | 6 个 API 路由 + 6 个 LLM 增强 + UI 集成 |
| Agent 3 | @zhixu/research | 修改 3 个现有路由 + 2 个 LLM 增强 |
| Agent 4 | @zhixu/undergrad | 6 个 API 路由 + 4 个 LLM 增强 + UI 集成 |
| Agent 5 | @zhixu/efficiency | 6 个 API 路由 + 3 个 LLM 增强 + UI 集成 |

**最后统一做**：
1. Skill Registry 注册（25 个新 Skills）
2. api-client.ts 扩展（新增 27 个 API 函数）
3. 全量测试验证
4. 类型检查和构建验证

---

## 8. 风险和边界

| 风险 | 缓解措施 |
|------|---------|
| LLM 调用延迟影响用户体验 | 所有 LLM 调用异步执行，前端显示 loading 状态 |
| LLM 输出质量不稳定 | 保留 heuristic fallback，LLM 输出标记为 yellow 需核验 |
| app.ts 文件过大（已 3800 行） | 新路由集中添加在文件末尾，后续再拆分 |
| 5 个 agent 并行可能冲突 | 每个 agent 修改不同的文件集，不互相覆盖 |
| 无 LLM 配置时的行为 | 所有增强方法检测 llm 可用性，自动降级到 heuristic |
