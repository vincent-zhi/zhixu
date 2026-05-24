import type { ToolDefinition } from "./types.js";

export interface ToolHandlerContext {
  listProjects: () => Promise<unknown[]>;
  getProject: (id: string) => Promise<unknown | null>;
  createProject: (input: Record<string, unknown>) => Promise<unknown>;
  addSource: (projectId: string, input: Record<string, unknown>) => Promise<unknown>;
  addTask: (projectId: string, input: Record<string, unknown>) => Promise<unknown>;
  createArtifact: (input: Record<string, unknown>) => Promise<unknown>;
  updateArtifactBlock: (artifactId: string, blockId: string, input: Record<string, unknown>) => Promise<unknown | null>;
  createHumanGate: (projectId: string, input: Record<string, unknown>) => Promise<unknown>;
  confirmHumanGate: (gateId: string, input: Record<string, unknown>) => Promise<unknown | null>;
  addEvidence: (projectId: string, input: Record<string, unknown>) => Promise<unknown>;
  addCapsule: (projectId: string, input: Record<string, unknown>) => Promise<unknown>;
  addMentorFeedback: (projectId: string, input: Record<string, unknown>) => Promise<unknown>;
  verifyCitations: (citations: Array<Record<string, unknown>>) => Promise<unknown>;
  checkWatcher: (projectId: string) => Promise<unknown>;
}

export class ToolRegistry {
  private readonly tools = new Map<
    string,
    { definition: ToolDefinition; handler: (args: Record<string, unknown>) => Promise<string> }
  >();

  register(definition: ToolDefinition, handler: (args: Record<string, unknown>) => Promise<string>): void {
    this.tools.set(definition.function.name, { definition, handler });
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((entry) => entry.definition);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new Error(`Tool not found: ${name}`);
    }
    return entry.handler(args);
  }
}

function tool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  handler: (args: Record<string, unknown>) => Promise<string>,
): { definition: ToolDefinition; handler: (args: Record<string, unknown>) => Promise<string> } {
  return {
    definition: {
      type: "function",
      function: { name, description, parameters },
    },
    handler,
  };
}

export function createZhiXuToolRegistry(context: ToolHandlerContext): ToolRegistry {
  const registry = new ToolRegistry();

  const listProjects = tool(
    "list_projects",
    "列出用户的所有项目。当用户询问'我有什么项目'、'项目列表'、'项目进度'、'最近的项目'或任何涉及项目查询的问题时，必须调用此工具获取真实项目数据，不要凭空编造。",
    {
      type: "object",
      properties: {},
      required: [],
    },
    async () => {
      const result = await context.listProjects();
      return JSON.stringify(result);
    },
  );

  const getProject = tool(
    "get_project",
    "获取指定项目的详细信息，包括状态、任务、来源等。当用户提到某个具体项目、询问项目详情或进度时，必须调用此工具。",
    {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
      },
      required: ["projectId"],
    },
    async (args) => {
      const result = await context.getProject(args["projectId"] as string);
      return JSON.stringify(result);
    },
  );

  const createProject = tool(
    "create_project",
    "创建一个新项目。当用户明确要求创建项目、新建课题、开始新任务时调用。",
    {
      type: "object",
      properties: {
        title: { type: "string", description: "项目标题" },
        type: { type: "string", description: "项目类型，如：paper/ppt/exam/experiment/other" },
        description: { type: "string", description: "项目描述" },
        dueDate: { type: "string", description: "截止日期" },
        priority: { type: "number", description: "优先级 0-5" },
        riskLevel: { type: "string", description: "风险等级 L0-L3" },
        privacyMode: { type: "string", description: "隐私模式" },
      },
      required: ["title", "type"],
    },
    async (args) => {
      const result = await context.createProject(args);
      return JSON.stringify(result);
    },
  );

  const addSource = tool(
    "add_source",
    "向项目上传源文件或参考资料。当用户要上传文件、添加资料、导入文献时调用。",
    {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
        fileName: { type: "string", description: "文件名" },
        fileType: { type: "string", description: "文件类型" },
        storageUri: { type: "string", description: "存储URI" },
        uploadedBy: { type: "string", description: "上传者" },
        sensitivityLevel: { type: "string", description: "敏感级别" },
      },
      required: ["projectId", "fileName", "fileType", "storageUri", "uploadedBy"],
    },
    async (args) => {
      const { projectId, ...input } = args;
      const result = await context.addSource(projectId as string, input);
      return JSON.stringify(result);
    },
  );

  const addTask = tool(
    "add_task",
    "向项目添加任务。当用户要创建任务、拆解工作、设置待办时调用。",
    {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
        title: { type: "string", description: "任务标题" },
        description: { type: "string", description: "任务描述" },
        assigneeType: { type: "string", description: "指派类型：ai/user/ai_human" },
        responsibilityLabel: { type: "string", description: "权责标签：green/yellow/gray" },
        priority: { type: "number", description: "优先级 0-5" },
        riskLevel: { type: "string", description: "风险等级" },
      },
      required: ["projectId", "title"],
    },
    async (args) => {
      const { projectId, ...input } = args;
      const result = await context.addTask(projectId as string, input);
      return JSON.stringify(result);
    },
  );

  const createArtifact = tool(
    "create_artifact",
    "创建项目产物（如PPT、文档、报告等）。当用户要生成PPT、写文档、创建报告时调用。",
    {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
        type: { type: "string", description: "产物类型：pptx/docx/markdown" },
        title: { type: "string", description: "产物标题" },
        firstBlock: {
          type: "object",
          properties: {
            blockType: { type: "string", description: "块类型" },
            contentJson: { type: "object", description: "内容JSON" },
            createdBy: { type: "string", description: "创建者" },
          },
          description: "首个块",
        },
      },
      required: ["projectId", "type", "title"],
    },
    async (args) => {
      const result = await context.createArtifact(args);
      return JSON.stringify(result);
    },
  );

  const updateArtifactBlock = tool(
    "update_artifact_block",
    "更新产物中的内容块。当用户要编辑、修改已创建的产物内容时调用。",
    {
      type: "object",
      properties: {
        artifactId: { type: "string", description: "产物ID" },
        blockId: { type: "string", description: "块ID" },
        contentJson: { type: "object", description: "内容JSON" },
        responsibilityColor: { type: "string", description: "权责颜色：green/yellow/gray" },
        verificationStatus: { type: "string", description: "验证状态" },
        updatedBy: { type: "string", description: "更新者" },
      },
      required: ["artifactId", "blockId", "updatedBy"],
    },
    async (args) => {
      const { artifactId, blockId, ...input } = args;
      const result = await context.updateArtifactBlock(
        artifactId as string,
        blockId as string,
        input,
      );
      return JSON.stringify(result);
    },
  );

  const createHumanGate = tool(
    "create_human_gate",
    "创建人工确认门，用于高风险操作前需要用户确认的场景。当操作涉及删除、发布、高风险变更时调用。",
    {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
        gateType: { type: "string", description: "门类型：publish/delete/export/risk_escalation" },
        reason: { type: "string", description: "需要确认的原因" },
        riskLevel: { type: "string", description: "风险等级：L1/L2/L3" },
      },
      required: ["projectId", "gateType", "reason"],
    },
    async (args) => {
      const { projectId, ...input } = args;
      const result = await context.createHumanGate(projectId as string, input);
      return JSON.stringify(result);
    },
  );

  const confirmHumanGate = tool(
    "confirm_human_gate",
    "确认人工确认门，表示用户已审核并同意操作。",
    {
      type: "object",
      properties: {
        gateId: { type: "string", description: "门ID" },
        confirmedBy: { type: "string", description: "确认人" },
      },
      required: ["gateId", "confirmedBy"],
    },
    async (args) => {
      const { gateId, ...input } = args;
      const result = await context.confirmHumanGate(gateId as string, input);
      return JSON.stringify(result);
    },
  );

  const verifyCitations = tool(
    "verify_citations",
    "验证论文或报告中的引用是否准确。当用户要检查引用、验证文献来源时调用。",
    {
      type: "object",
      properties: {
        citations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rawText: { type: "string", description: "原始引用文本" },
              doi: { type: "string", description: "DOI" },
              title: { type: "string", description: "标题" },
              year: { type: "number", description: "年份" },
            },
            required: ["rawText"],
          },
          description: "引用列表",
        },
      },
      required: ["citations"],
    },
    async (args) => {
      const result = await context.verifyCitations(
        args["citations"] as Array<Record<string, unknown>>,
      );
      return JSON.stringify(result);
    },
  );

  const checkWatcher = tool(
    "check_watcher",
    "检查项目的问题和提醒，如即将到期、停滞、缺少证据等。当用户询问项目状态、待办提醒时调用。",
    {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
      },
      required: ["projectId"],
    },
    async (args) => {
      const result = await context.checkWatcher(args["projectId"] as string);
      return JSON.stringify(result);
    },
  );

  const addEvidence = tool(
    "add_evidence",
    "向项目添加证据，用于标注可溯源内容。当需要记录来源依据时调用。",
    {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
        sourceId: { type: "string", description: "来源ID" },
        artifactId: { type: "string", description: "产物ID" },
        blockId: { type: "string", description: "块ID" },
        evidenceType: { type: "string", description: "证据类型：quote/statistic/fact" },
        quoteText: { type: "string", description: "引用文本" },
        confidence: { type: "number", description: "置信度 0-1" },
      },
      required: ["projectId", "evidenceType"],
    },
    async (args) => {
      const { projectId, ...input } = args;
      const result = await context.addEvidence(projectId as string, input);
      return JSON.stringify(result);
    },
  );

  const createCapsule = tool(
    "create_capsule",
    "创建知识胶囊，保存可复用的知识结构。当完成一个阶段需要沉淀知识时调用。",
    {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
        title: { type: "string", description: "胶囊标题" },
        summary: { type: "string", description: "摘要" },
        capsuleType: { type: "string", description: "胶囊类型：methodology/template/checklist" },
      },
      required: ["projectId", "title", "summary"],
    },
    async (args) => {
      const { projectId, ...input } = args;
      const result = await context.addCapsule(projectId as string, input);
      return JSON.stringify(result);
    },
  );

  const addMentorFeedback = tool(
    "add_mentor_feedback",
    "添加导师反馈，记录导师的修改意见。当用户转述导师意见、需要拆解反馈时调用。",
    {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
        rawContent: { type: "string", description: "反馈原始内容" },
        sourceType: { type: "string", description: "来源类型：email/meeting/document" },
        sourceId: { type: "string", description: "来源ID" },
      },
      required: ["projectId", "rawContent", "sourceType"],
    },
    async (args) => {
      const { projectId, ...input } = args;
      const result = await context.addMentorFeedback(projectId as string, input);
      return JSON.stringify(result);
    },
  );

  const allTools = [
    listProjects,
    getProject,
    createProject,
    addSource,
    addTask,
    createArtifact,
    updateArtifactBlock,
    createHumanGate,
    confirmHumanGate,
    verifyCitations,
    checkWatcher,
    addEvidence,
    createCapsule,
    addMentorFeedback,
  ];

  for (const t of allTools) {
    registry.register(t.definition, t.handler);
  }

  return registry;
}
