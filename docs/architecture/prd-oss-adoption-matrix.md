# 知序 PRD 与开源能力吸收矩阵

日期：2026-05-23

## 目标

知序必须严格按 PRD 和技术规定构建：系统核心是 Project-first Agent OS，不是通用聊天助手，也不是单点 PPT/Word 生成器。开源项目只作为能力来源和工程参考，知序自研部分必须集中在项目制、证据链、三色责任、Human Gate、学术合规、知识胶囊和长期记忆。

## 硬约束

- 所有资料、任务、对话、产物、证据、版本、权限、日志、提醒、记忆和 Skill 调用必须挂靠 Project。
- 所有 Agent 输出必须包含 `output_type`、`structured_result`、`confidence`、`required_confirmations`、`evidence_refs`、`risk_flags`、`next_actions`、`cost_estimate`。
- 文件解析必须保留页码、段落、表格、图片区域、引用、批注、修订痕迹和证据定位。
- PPT/DOCX/PDF/Markdown 导出前必须经过 Verifier 和 Human Gate。
- 敏感资料上云、第三方 Skill 调用、最终导出、外发、删除、覆盖版本、引用补全、实验结论生成必须 Human Gate。
- 不使用、复制或复刻非授权泄露提示词。只吸收公开、合法、许可证清晰的 prompt/skill 工程模式。

## 开源吸收原则

| 类型 | 策略 |
| --- | --- |
| 文档解析引擎 | 优先复用成熟项目，通过 provider adapter 接入，不把第三方输出直接写入业务模型。 |
| PPT/DOCX 生成 | 复用 OOXML 生态工具，知序自研主题、版式策略、证据绑定和导出检查。 |
| Agent 架构 | 借鉴 gateway、skills、memory、subagents、self-improvement，但自研 Project-first runtime。 |
| Prompt/Skills | 学习公开工程模式，重写为知序任务、证据、合规、学术场景专用提示。 |
| 记忆系统 | 借鉴长期上下文和自我改进，但所有记忆必须经过归属、权限、复用范围和 Human Gate。 |
| 安全沙箱 | 借鉴能力边界、权限声明、调用日志和 trace，不允许第三方 Skill 默认读取全局文件或外发资料。 |

## PRD 功能到实现策略

| PRD/技术规定能力 | 知序自研核心 | 可吸收开源能力 | 第一阶段实现方向 |
| --- | --- | --- | --- |
| Project-first 容器 | Project、Workspace、Source、Task、Artifact、Evidence、Version、AuditLog、HumanGate | 无，必须自研 | 已建核心 schema，下一步接 Prisma 仓储 |
| Agent OS | Steward Router、Planner、Dispatcher、Worker、Verifier、Watcher、Memory、Reflection | OpenClaw gateway/skills 思路，Hermes memory/subagents/self-improvement 思路 | 新建 `packages/agent-core` 和 `apps/server/src/zhixu-steward` |
| Skill Runtime | PermissionGrant、SkillInvocation、risk_level、sandbox policy、Human Gate | OpenClaw skills/tool runtime 思路 | 先做内置官方 Skills，不开放第三方 |
| 文件解析 | Source Pipeline、EvidenceAnchor、sensitivity、parse/index status | Docling、MarkItDown、Unstructured、Mammoth、pdfplumber、pypdf | provider adapter：`docling` 优先结构化，`markitdown` 快速 markdown fallback |
| PDF 解析 | 页码、段落、表格、图片区域、参考文献区、OCR | Docling、Unstructured、pdfplumber、pypdf、Poppler | 输出 `DocumentNode` + `EvidenceAnchor` |
| PPTX 解析 | 页标题、层级、备注、图表、图片、布局 | Docling、MarkItDown、OOXML parser | 输出 `SlideNode`，保留 speaker notes 和 layout metadata |
| DOCX 解析 | 标题层级、段落、表格、引用、批注、修订痕迹 | Mammoth、Docling、python-docx/OpenXML | 输出结构化 blocks，并标注批注/修订来源 |
| 图片/OCR | OCR、版面区域、公式/手写识别 | Docling OCR、Tesseract/PaddleOCR 后续评估 | 第一阶段只定义接口，不先接重模型 |
| Artifact Canvas | block editing、version diff、evidence binding、responsibility_color | 不直接复用编辑器核心 | 自研 block model，UI 后续选 ProseMirror/Lexical/Tiptap 评估 |
| PPT 共创 | 选题、三方案、大纲、页级确认、视觉风格、备注、导出 | PptxGenJS、公开 slide layout patterns | `PptSkill` 生成 PPTX，知序主题和证据 notes 自研 |
| Word/报告共创 | 结构化报告、引用、段落级 AI command、导出 | docx/OpenXML、python-docx、LibreOffice render check | `DocxSkill` 生成 DOCX，引用核验和责任标记自研 |
| 引用核验 | CitationRecord、正文引用/参考文献/证据一致性 | Crossref/Semantic Scholar/OpenAlex API 可接入 | 第一阶段 schema + verifier contract |
| 三色权责 | green/yellow/gray 责任色、导出前占比和风险 | 无，必须自研 | 已在 ArtifactBlock/Evidence schema 中建立 |
| Human Gate | 高风险确认、审计记录、权限边界 | 借鉴 HITL patterns | 已有 API，下一步与 Agent/Skill 调用强绑定 |
| 成本控制 | Cost Controller、额度、降级方案 | 模型 provider usage metadata | ModelGateway 统一 cost estimate |
| 知识胶囊 | 项目复盘、可复用结构、导师偏好、用户确认观点 | Hermes memory/self-improvement 思路 | Reflection Engine 产出候选 capsule，用户确认后保存 |
| Watcher | 截止提醒、停滞检测、重排计划 | cron/queue patterns | 先做 scheduled job contract |
| 本地优先模式 | 本地解析、轻量索引、敏感资料提示 | Docling local execution、Tauri 本地能力 | 桌面端先承接 local parser adapter |

## 推荐开源组件分层

### Document Intelligence

- `DoclingProvider`：高质量结构化解析首选。优点是多格式、PDF layout、表格、OCR、统一文档表示、local execution 和 GenAI 集成。适合知序敏感资料和学术资料处理。
- `MarkItDownProvider`：快速转换为 Markdown 的 fallback。适合轻解析、预览、低成本索引、快速问答。
- `MammothProvider`：DOCX 到语义 HTML/文本的补充路径。适合报告和 Word 文档结构恢复。
- `PdfPlumberProvider` / `PyPdfProvider`：PDF 元数据、页文本、页码和快速证据定位补充。

### Artifact Factory

- `PptxGenProvider`：PPTX 生成首选。知序自研 slide schema、品牌主题、版式策略、页级 evidence notes、导出前 verifier。
- `DocxProvider`：优先评估 `docx`/OpenXML SDK/python-docx。知序自研报告结构、引用块、责任标记和渲染 QA。
- `RenderCheckProvider`：LibreOffice + Poppler 渲染检查，校验 PPTX/DOCX/PDF 的中文字体、分页、图表、引用和布局。

### Agent Runtime

- `ZhiXu Gateway`：吸收 OpenClaw 的 control-plane/gateway 思路，但输入统一为 ProjectEvent。
- `ZhiXu Skills`：吸收 OpenClaw skills 权限化思路，所有 Skill 带 schema、permissions、risk、quota、trace。
- `ZhiXu Memory`：吸收 Hermes 长期记忆和自我改进，但只保存用户确认过的 Project/User/Capsule memory。
- `ZhiXu Reflection`：吸收 Hermes self-improvement 思路，但只能生成候选规则、候选 skill patch、候选 capsule，不自动改变生产行为。

## 提示词与 Skills 政策

允许：

- 学习公开仓库中许可证清晰的 prompt patterns、agent role decomposition、tool schemas、eval rubrics。
- 学习官方 SDK、官方 cookbook、公开 benchmark 和安全模式。
- 将通用模式重写为知序专用提示：项目制、资料范围、证据优先、三色责任、Human Gate、学术合规。

禁止：

- 使用、复制、整理、传播所谓泄露的 Claude Code / 商业系统提示词。
- 把第三方 prompt 原文作为知序系统提示词。
- 让 prompt 绕过合规限制、自动提交作业、伪造引用、规避查重、越权下载全文。

## 知序管家第一阶段拆分

### 1. `packages/agent-core`

定义：

- `ProjectEvent`
- `AgentState`
- `AgentStep`
- `ToolCall`
- `SkillCall`
- `AgentTrace`
- `MemoryCandidate`
- `ReflectionCandidate`
- `DocumentNode`
- `EvidenceAnchor`

### 2. `apps/server/src/zhixu-steward`

实现：

- `StewardRouter`
- `ContextBuilder`
- `PlannerAgent`
- `DispatcherAgent`
- `VerifierAgent`
- `MemoryAgent`
- `ReflectionEngine`

### 3. `packages/document-intelligence`

实现 provider interface：

- `DocumentParserProvider`
- `DoclingProvider`
- `MarkItDownProvider`
- `MammothProvider`
- `ParseResultNormalizer`

### 4. `packages/artifact-factory`

实现 provider interface：

- `ArtifactRenderer`
- `PptxRenderer`
- `DocxRenderer`
- `MarkdownRenderer`
- `RenderQaRunner`

### 5. `packages/skill-runtime`

实现：

- `SkillDefinition`
- `PermissionPolicy`
- `SkillInvocationRunner`
- `SkillSandboxPolicy`
- `HumanGateRequiredError`

## 选型结论

第一阶段不追求一次接入所有库。优先顺序：

1. 自研 `agent-core` 与 `skill-runtime`，因为这是知序差异化核心。
2. 接 `MarkItDownProvider` 做快速文件到 Markdown，跑通 Source Pipeline。
3. 接 `PptxGenProvider` 做第一版 PPTX 生成。
4. 接 `DoclingProvider` 做高质量结构化解析。
5. 接 `DocxProvider` 做报告生成。
6. 接 `ReflectionEngine` 做知识胶囊候选和自我改进候选。

## 参考来源

- OpenClaw: https://github.com/openclaw/openclaw
- Hermes Agent: https://github.com/NousResearch/hermes-agent
- Docling: https://github.com/docling-project/docling
- MarkItDown: https://github.com/microsoft/markitdown
- PptxGenJS: https://github.com/gitbrent/PptxGenJS
- Mammoth.js: https://github.com/mwilliamson/mammoth.js
- Unstructured: https://github.com/Unstructured-IO/unstructured
