import type {
  ProjectSummary,
  ProjectDetail,
  CreateProjectInput,
  CreateSourceInput,
  SourceSummary,
  CreateTaskInput,
  TaskSummary,
  CreateArtifactInput,
  ArtifactSummary,
  UpdateArtifactBlockInput,
  ArtifactBlockSummary,
  CreateHumanGateInput,
  HumanGateSummary,
  ConfirmHumanGateInput,
  AgentJobSummary,
  GeneratePlanInput,
  VerifyOutputInput,
} from "@zhixu/core";

export type { ArtifactBlockSummary };

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly requestId: string | undefined;
  readonly details: ApiError;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error;
  }
}

interface ApiResponse<T> {
  data: T;
}

interface ApiErrorResponse {
  error: ApiError;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    let errorBody: ApiError = {
      code: "UNKNOWN_ERROR",
      message: `Request failed with status ${response.status}`,
    };
    try {
      const parsed = (await response.json()) as ApiErrorResponse;
      if (parsed.error) {
        errorBody = parsed.error;
      }
    } catch {}
    throw new ApiClientError(errorBody);
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as ApiResponse<T>;
    return body.data;
  }

  return response as unknown as T;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface ReadyResponse {
  status: string;
  checks: {
    api: string;
    database: string;
  };
}

export interface StateDefinition {
  status: string;
  entryCondition: string;
  exitCondition: string;
  owner: "system" | "user" | "ai" | "ai_human";
  allowedActions: string[];
  timeoutPolicy: { timeoutMs: number; action: "auto_advance" | "alert" | "rollback" };
  riskPolicy: { maxRiskLevel: string; escalationAction: string };
}

export interface TransitionResult {
  from: string;
  to: string;
}

export interface TransitionInput {
  trigger: string;
  confirmations?: string[];
}

export interface EvidenceSummary {
  id: string;
  projectId: string;
  sourceId: string | null;
  artifactId: string | null;
  blockId: string | null;
  evidenceType: string;
  pageNumber: number | null;
  textSpan: string | null;
  quoteText: string | null;
  confidence: number;
  responsibilityColor: string;
  verificationStatus: string;
  createdAt: string;
}

export interface CreateEvidenceInput {
  sourceId?: string;
  artifactId?: string;
  blockId?: string;
  evidenceType: string;
  quoteText?: string;
  pageNumber?: number;
  textSpan?: string;
  url?: string;
  confidence?: number;
}

export interface KnowledgeCapsuleSummary {
  id: string;
  projectId: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  capsuleType: string;
  summary: string;
  privacyScope: string;
  reuseCount: number;
  createdAt: string;
}

export interface CreateCapsuleInput {
  title: string;
  capsuleType?: string;
  summary: string;
  reusableStructureJson?: Record<string, unknown>;
  reusableTasksJson?: Record<string, unknown>[];
  keyEvidenceIds?: string[];
  privacyScope?: string;
}

export interface CitationInput {
  rawText: string;
  doi?: string;
  title?: string;
  year?: number;
}

export interface CitationVerificationResult {
  rawText: string;
  status: "verified" | "needs_review" | "rejected";
  issues: string[];
  normalizedDoi?: string;
  normalizedTitle?: string;
}

export interface WatcherIssue {
  type: "due_soon" | "stalled" | "missing_evidence" | "pending_human_gate" | "overdue";
  severity: "info" | "warning" | "critical";
  message: string;
  targetId: string;
  targetType: "project" | "task" | "artifact" | "human_gate";
}

export interface WatcherCheckResult {
  projectId: string;
  projectTitle: string;
  issues: WatcherIssue[];
}

export interface VersionSummary {
  id: string;
  entityType: string;
  entityId: string;
  projectId: string;
  snapshotJson: Record<string, unknown>;
  diffJson: Record<string, unknown> | null;
  createdBy: string;
  createdReason: string;
  createdAt: string;
}

export interface CreateVersionInput {
  entityType: string;
  entityId: string;
  snapshotJson: Record<string, unknown>;
  createdBy: string;
  createdReason?: string;
}

export interface MentorFeedbackActionItem {
  id: string;
  content: string;
  boundEntityType: string | null;
  boundEntityId: string | null;
  status: string;
}

export interface MentorFeedbackSummary {
  id: string;
  projectId: string;
  sourceType: string;
  sourceId: string | null;
  rawContent: string;
  feedbackType: string;
  actionItems: MentorFeedbackActionItem[];
  bindingStatus: string;
  boundArtifactId: string | null;
  boundBlockId: string | null;
  boundTaskId: string | null;
  resolutionStatus: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  mentorPreference: Record<string, unknown>;
  createdAt: string;
}

export interface CreateMentorFeedbackInput {
  sourceType: string;
  sourceId?: string;
  rawContent: string;
  feedbackType?: string;
}

export interface BindFeedbackInput {
  actionItemId: string;
  entityType: string;
  entityId: string;
}

export interface ResolveFeedbackInput {
  resolvedBy: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  quotaType: string;
  usedAmount: number;
  limitAmount: number;
  remainingAmount: number;
  degradationOptions: string[];
}

export interface CheckQuotaInput {
  quotaType: string;
  requestedAmount?: number;
}

export interface SkillManifest {
  id: string;
  name: string;
  provider: string;
  version: string;
  description: string;
  permissions: Array<{
    scope: string;
    description: string;
    riskLevel: string;
    defaultGranted: boolean;
  }>;
  riskLevel: string;
  runtimeType: "native" | "workflow" | "sandbox" | "external_api" | "local_only";
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface InvokeSkillInput {
  userId?: string;
  projectId?: string;
  input?: Record<string, unknown>;
}

export interface ChatInput {
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
  systemPrompt?: string;
}

export interface ChatResult {
  response: {
    content: string | null;
    toolCalls: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }> | null;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    model: string;
    finishReason: string;
  };
  toolResults?: Array<{
    toolCallId: string;
    functionName: string;
    arguments: Record<string, unknown>;
    result: string;
  }>;
}

export interface FeedbackParseInput {
  sourceId?: string;
  feedbackType?: string;
  comment?: string;
}

export interface FeedbackParseResult {
  received: boolean;
}

export interface ProjectEvent {
  eventType: "source_intake_requested" | "user_goal_submitted" | "artifact_block_updated" | "human_gate_confirmed" | "project_completed";
  actorId: string;
  payload?: Record<string, unknown>;
}

export interface StewardWorkflowRun {
  id: string;
  projectId: string;
  eventType: string;
  status: "completed" | "waiting_human" | "failed";
  routedTo: string;
  steps: Array<{ name: string; status: "completed" | "skipped" | "failed"; detail?: string }>;
  agentJobs: AgentJobSummary[];
  requiredConfirmations: string[];
  riskFlags: string[];
  traceId: string;
  createdAt: string;
}

export interface LLMConfigStatus {
  configured: boolean;
  baseURL: string;
  model: string;
  enableThinking: boolean;
  apiKeySet: boolean;
  isLLMGateway: boolean;
}

export interface UpdateLLMConfigInput {
  apiKey?: string;
  baseURL: string;
  model: string;
  enableThinking?: boolean;
}

export interface MemoryCandidate {
  id: string;
  projectId: string;
  memoryType: "knowledge_capsule" | "user_preference" | "mentor_preference";
  title: string;
  summary: string;
  reusableStructure: Record<string, unknown>;
  evidenceRefs: string[];
  status: "pending_confirmation" | "saved" | "rejected";
  createdAt: string;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function getReady(): Promise<ReadyResponse> {
  return request<ReadyResponse>("/ready");
}

export function listProjects(): Promise<ProjectSummary[]> {
  return request<ProjectSummary[]>("/api/projects");
}

export function createProject(input: CreateProjectInput): Promise<ProjectSummary> {
  return request<ProjectSummary>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getProject(id: string): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/api/projects/${id}`);
}

export function getProjectState(id: string): Promise<StateDefinition> {
  return request<StateDefinition>(`/api/projects/${id}/state`);
}

export function transitionProject(id: string, input: TransitionInput): Promise<TransitionResult> {
  return request<TransitionResult>(`/api/projects/${id}/transition`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function addSource(projectId: string, input: CreateSourceInput): Promise<SourceSummary> {
  return request<SourceSummary>(`/api/projects/${projectId}/sources`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UploadResult {
  id: string;
  projectId: string;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  storageUri: string;
  parseStatus: string;
  ocrStatus: string;
  indexStatus: string;
  sensitivityLevel: string;
  createdAt: string;
}

export function getFileUrl(projectId: string, filename: string): string {
  return `${BASE_URL}/api/files/${projectId}/${encodeURIComponent(filename)}`;
}

export async function uploadFile(projectId: string, file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const url = `${BASE_URL}/api/projects/${projectId}/sources/upload`;
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });
  if (!response.ok) {
    let errorBody: ApiError = {
      code: "UNKNOWN_ERROR",
      message: `Upload failed with status ${response.status}`,
    };
    try {
      const parsed = (await response.json()) as ApiErrorResponse;
      if (parsed.error) {
        errorBody = parsed.error;
      }
    } catch {}
    throw new ApiClientError(errorBody);
  }
  const body = (await response.json()) as ApiResponse<UploadResult>;
  return body.data;
}

export function listSources(projectId: string): Promise<SourceSummary[]> {
  return request<SourceSummary[]>(`/api/projects/${projectId}/sources`);
}

export function addTask(projectId: string, input: CreateTaskInput): Promise<TaskSummary> {
  return request<TaskSummary>(`/api/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listTasks(projectId: string): Promise<TaskSummary[]> {
  return request<TaskSummary[]>(`/api/projects/${projectId}/tasks`);
}

export function createArtifact(input: CreateArtifactInput): Promise<ArtifactSummary> {
  return request<ArtifactSummary>("/api/artifacts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listArtifacts(projectId: string): Promise<ArtifactSummary[]> {
  return request<ArtifactSummary[]>(`/api/projects/${projectId}/artifacts`);
}

export function updateArtifactBlock(
  artifactId: string,
  blockId: string,
  input: UpdateArtifactBlockInput
): Promise<ArtifactBlockSummary> {
  return request<ArtifactBlockSummary>(
    `/api/artifacts/${artifactId}/blocks/${blockId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export function exportArtifactPptx(
  artifactId: string,
  options?: { userId?: string }
): Promise<Blob> {
  return requestRaw(`/api/artifacts/${artifactId}/export/pptx`, {
    method: "POST",
    body: JSON.stringify({ userId: options?.userId ?? "anonymous" }),
  });
}

export function exportArtifactDocx(
  artifactId: string,
  options?: { userId?: string }
): Promise<Blob> {
  return requestRaw(`/api/artifacts/${artifactId}/export/docx`, {
    method: "POST",
    body: JSON.stringify({ userId: options?.userId ?? "anonymous" }),
  });
}

export function exportArtifactMarkdown(
  artifactId: string,
  options?: { userId?: string }
): Promise<Blob> {
  return requestRaw(`/api/artifacts/${artifactId}/export/markdown`, {
    method: "POST",
    body: JSON.stringify({ userId: options?.userId ?? "anonymous" }),
  });
}

export function createHumanGate(
  projectId: string,
  input: CreateHumanGateInput
): Promise<HumanGateSummary> {
  return request<HumanGateSummary>(`/api/projects/${projectId}/human-gates`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listHumanGates(projectId: string): Promise<HumanGateSummary[]> {
  return request<HumanGateSummary[]>(`/api/projects/${projectId}/human-gates`);
}

export function confirmHumanGate(
  gateId: string,
  input: ConfirmHumanGateInput
): Promise<HumanGateSummary> {
  return request<HumanGateSummary>(`/api/human-gates/${gateId}/confirm`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function addEvidence(
  projectId: string,
  input: CreateEvidenceInput
): Promise<EvidenceSummary> {
  return request<EvidenceSummary>(`/api/projects/${projectId}/evidence`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listEvidence(projectId: string): Promise<EvidenceSummary[]> {
  return request<EvidenceSummary[]>(`/api/projects/${projectId}/evidence`);
}

export function addCapsule(
  projectId: string,
  input: CreateCapsuleInput
): Promise<KnowledgeCapsuleSummary> {
  return request<KnowledgeCapsuleSummary>(`/api/projects/${projectId}/capsules`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listCapsules(projectId: string): Promise<KnowledgeCapsuleSummary[]> {
  return request<KnowledgeCapsuleSummary[]>(`/api/projects/${projectId}/capsules`);
}

export function verifyCitations(
  citations: CitationInput[]
): Promise<CitationVerificationResult[]> {
  return request<CitationVerificationResult[]>("/api/citations/verify", {
    method: "POST",
    body: JSON.stringify({ citations }),
  });
}

export function checkWatcher(): Promise<WatcherCheckResult[]> {
  return request<WatcherCheckResult[]>("/api/watcher/check");
}

export function getProjectReminders(projectId: string): Promise<WatcherCheckResult> {
  return request<WatcherCheckResult>(`/api/projects/${projectId}/reminders`);
}

export function createVersion(
  projectId: string,
  input: CreateVersionInput
): Promise<VersionSummary> {
  return request<VersionSummary>(`/api/projects/${projectId}/versions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listVersions(
  entityType: string,
  entityId: string
): Promise<VersionSummary[]> {
  return request<VersionSummary[]>(`/api/versions/${entityType}/${entityId}`);
}

export function getVersion(versionId: string): Promise<VersionSummary> {
  return request<VersionSummary>(`/api/versions/${versionId}`);
}

export function rollbackVersion(versionId: string): Promise<VersionSummary> {
  return request<VersionSummary>(`/api/versions/${versionId}/rollback`, {
    method: "POST",
  });
}

export function addMentorFeedback(
  projectId: string,
  input: CreateMentorFeedbackInput
): Promise<MentorFeedbackSummary> {
  return request<MentorFeedbackSummary>(
    `/api/projects/${projectId}/mentor-feedback`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export function listMentorFeedback(
  projectId: string
): Promise<MentorFeedbackSummary[]> {
  return request<MentorFeedbackSummary[]>(
    `/api/projects/${projectId}/mentor-feedback`
  );
}

export function bindFeedbackItem(
  feedbackId: string,
  input: BindFeedbackInput
): Promise<MentorFeedbackSummary> {
  return request<MentorFeedbackSummary>(
    `/api/mentor-feedback/${feedbackId}/bind`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export function resolveFeedbackItem(
  feedbackId: string,
  input: ResolveFeedbackInput
): Promise<MentorFeedbackSummary> {
  return request<MentorFeedbackSummary>(
    `/api/mentor-feedback/${feedbackId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export function getQuota(userId: string): Promise<QuotaCheckResult[]> {
  return request<QuotaCheckResult[]>(`/api/quota/${userId}`);
}

export function checkQuota(
  userId: string,
  input: CheckQuotaInput
): Promise<QuotaCheckResult> {
  return request<QuotaCheckResult>(`/api/quota/${userId}/check`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listSkills(): Promise<SkillManifest[]> {
  return request<SkillManifest[]>("/api/skills");
}

export function invokeSkill(
  skillId: string,
  input: InvokeSkillInput
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/skills/${skillId}/invoke`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listAgentJobs(): Promise<AgentJobSummary[]> {
  return request<AgentJobSummary[]>("/api/agent-jobs");
}

export function generatePlan(
  projectId: string,
  input: GeneratePlanInput
): Promise<AgentJobSummary> {
  return request<AgentJobSummary>(`/api/projects/${projectId}/agent/plan`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyOutput(
  projectId: string,
  input: VerifyOutputInput
): Promise<AgentJobSummary> {
  return request<AgentJobSummary>(`/api/projects/${projectId}/agent/verify`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function chat(input: ChatInput): Promise<ChatResult> {
  return request<ChatResult>("/api/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface StreamCallbacks {
  onLifecycle?: (data: { phase: string; runId?: string; round?: number; error?: string; durationMs?: number }) => void;
  onToolStart?: (data: { toolCallId: string; functionName: string }) => void;
  onToolProgress?: (data: { toolCallId: string; functionName: string; status: string }) => void;
  onToolEnd?: (data: { toolCallId: string; functionName: string; result: string; durationMs?: number }) => void;
  onToolResult?: (data: { toolCallId: string; functionName: string; result: string }) => void;
  onThinkingStart?: () => void;
  onThinkingDelta?: (content: string) => void;
  onThinkingEnd?: (content: string) => void;
  onContentDelta?: (content: string) => void;
  onDone?: (data: { finishReason: string; thinking?: string; content?: string; rounds?: number }) => void;
  onError?: (message: string) => void;
}

export async function chatStream(input: ChatInput, callbacks: StreamCallbacks): Promise<void> {
  const url = `${BASE_URL}/api/chat/stream`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Stream failed with status ${response.status}`;
    try {
      const parsed = (await response.json()) as ApiErrorResponse;
      if (parsed.error) message = parsed.error.message ?? message;
    } catch {}
    callbacks.onError?.(message);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) { callbacks.onError?.("No response body"); return; }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        try {
          const data = JSON.parse(dataStr);
          switch (currentEvent) {
            case "lifecycle": callbacks.onLifecycle?.(data); break;
            case "tool_start": callbacks.onToolStart?.(data); break;
            case "tool_progress": callbacks.onToolProgress?.(data); break;
            case "tool_end": callbacks.onToolEnd?.(data); break;
            case "tool_result": callbacks.onToolResult?.(data); break;
            case "thinking_start": callbacks.onThinkingStart?.(); break;
            case "thinking_delta": callbacks.onThinkingDelta?.(data.content); break;
            case "thinking_end": callbacks.onThinkingEnd?.(data.content); break;
            case "content_delta": callbacks.onContentDelta?.(data.content); break;
            case "done": callbacks.onDone?.(data); break;
            case "error": callbacks.onError?.(data.message); break;
          }
        } catch {}
      }
    }
  }
}

export function getTrace(traceId: string): Promise<AgentJobSummary> {
  return request<AgentJobSummary>(`/api/traces/${traceId}`);
}

export function parseFeedback(input: FeedbackParseInput): Promise<FeedbackParseResult> {
  return request<FeedbackParseResult>("/api/feedback/parse", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getLLMConfig(): Promise<LLMConfigStatus> {
  return request<LLMConfigStatus>("/api/settings/llm");
}

export function updateLLMConfig(input: UpdateLLMConfigInput): Promise<LLMConfigStatus> {
  return request<LLMConfigStatus>("/api/settings/llm", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteLLMConfig(): Promise<LLMConfigStatus> {
  return request<LLMConfigStatus>("/api/settings/llm", {
    method: "DELETE",
  });
}

export function listMemoryCandidates(projectId: string): Promise<MemoryCandidate[]> {
  return request<MemoryCandidate[]>(`/api/projects/${projectId}/memory-candidates`);
}

export function postProjectEvent(
  projectId: string,
  event: ProjectEvent
): Promise<StewardWorkflowRun> {
  return request<StewardWorkflowRun>(`/api/projects/${projectId}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });
}

async function requestRaw(
  path: string,
  options: RequestInit = {}
): Promise<Blob> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    let errorBody: ApiError = {
      code: "UNKNOWN_ERROR",
      message: `Request failed with status ${response.status}`,
    };
    try {
      const parsed = (await response.json()) as ApiErrorResponse;
      if (parsed.error) {
        errorBody = parsed.error;
      }
    } catch {}
    throw new ApiClientError(errorBody);
  }

  return response.blob();
}

export interface PaperMatrix {
  sourceId: string;
  fileName: string;
  researchQuestion: string;
  backgroundMotivation: string;
  methodFramework: string;
  dataset: string;
  experimentSetup: string;
  results: string;
  contributions: string;
  limitations: string;
  reproducibility: string;
  responsibilityColor: string;
}

export interface PaperComparison {
  sourceIds: string[];
  methodCategories: string[];
  timeline: string[];
  disputes: string[];
  researchGaps: string[];
  matrix: Record<string, Record<string, string>>;
  responsibilityColor: string;
}

export interface PaperMatrixResult {
  sourceIds: string[];
  dimensions: string[];
  rows: Array<{ dimension: string; values: Record<string, string> }>;
  responsibilityColor: string;
}

export interface ExamPlan {
  examDate: string;
  daysUntil: number;
  dailyHours: number;
  knowledgeMap: { summary: string; topics: string[] };
  plan: Array<{ day: number; tasks: string[]; duration: number }>;
  responsibilityColor: string;
}

export interface ExamQuestion {
  id: string;
  projectId: string;
  topic: string;
  questionType: string;
  questionText: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  createdAt: string;
}

export interface ExamSubmission {
  id: string;
  questionId: string;
  projectId: string;
  answer: string;
  correct: boolean;
  explanation: string;
  mistakeType: string | null;
  createdAt: string;
}

export interface ExamMistake extends ExamSubmission {
  questionText: string;
  correctAnswer: string;
  topic: string;
}

export interface ThreePlanOption {
  label: string;
  completionProbability: number;
  overtimeRisk: number;
  contentErrorRisk: number;
  sourceGapRisk: number;
  aiInvolvementRatio: number;
  userEffortHours: number;
  qualityCeiling: number;
  applicableScenario: string;
  tasks: string[];
}

export interface ThreePlanResult {
  balanced: ThreePlanOption;
  rush: ThreePlanOption;
  safe: ThreePlanOption;
  comparisonSummary: string;
}

export function paperRead(projectId: string, input: { sourceId: string }): Promise<PaperMatrix> {
  return request<PaperMatrix>(`/api/projects/${projectId}/paper/read`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function paperCompare(projectId: string, input: { sourceIds: string[] }): Promise<PaperComparison> {
  return request<PaperComparison>(`/api/projects/${projectId}/paper/compare`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function paperMatrix(projectId: string, input: { sourceIds: string[]; dimensions?: string[] }): Promise<PaperMatrixResult> {
  return request<PaperMatrixResult>(`/api/projects/${projectId}/paper/matrix`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function examPlan(projectId: string, input: { examDate: string; dailyHours?: number }): Promise<ExamPlan> {
  return request<ExamPlan>(`/api/projects/${projectId}/exam/plan`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function examQuestions(projectId: string, input: { topic: string; questionTypes?: string[]; count?: number }): Promise<ExamQuestion[]> {
  return request<ExamQuestion[]>(`/api/projects/${projectId}/exam/questions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function examSubmit(projectId: string, input: { questionId: string; answer: string }): Promise<ExamSubmission> {
  return request<ExamSubmission>(`/api/projects/${projectId}/exam/submit`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function examMistakes(projectId: string): Promise<ExamMistake[]> {
  return request<ExamMistake[]>(`/api/projects/${projectId}/exam/mistakes`);
}

export { listProjects as getProjects, checkWatcher as getWatcherChecks };

export async function listArtifactBlocks(artifactId: string): Promise<ArtifactBlockSummary[]> {
  return request<ArtifactBlockSummary[]>(`/api/artifacts/${artifactId}/blocks`);
}

export async function createArtifactBlock(artifactId: string, data: { blockType: string; contentJson: Record<string, unknown>; orderIndex: number; responsibilityColor?: string }): Promise<ArtifactBlockSummary> {
  return request<ArtifactBlockSummary>(`/api/artifacts/${artifactId}/blocks`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteArtifactBlock(artifactId: string, blockId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/artifacts/${artifactId}/blocks/${blockId}`, {
    method: "DELETE",
  });
}

export async function reorderArtifactBlocks(artifactId: string, blockIds: string[]): Promise<ArtifactBlockSummary[]> {
  return request<ArtifactBlockSummary[]>(`/api/artifacts/${artifactId}/blocks/reorder`, {
    method: "POST",
    body: JSON.stringify({ blockIds }),
  });
}

export async function executeAICommand(projectId: string, artifactId: string, blockId: string, command: string): Promise<ArtifactBlockSummary> {
  return request<ArtifactBlockSummary>(`/api/projects/${projectId}/artifacts/doc/ai-command`, {
    method: "POST",
    body: JSON.stringify({ artifactId, blockId, command }),
  });
}

export async function generatePPTOutline(projectId: string, data: { artifactId: string; selectedTopic: string; slideCount?: number }): Promise<ArtifactBlockSummary[]> {
  return request<ArtifactBlockSummary[]>(`/api/projects/${projectId}/artifacts/ppt/outline`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function generatePPTSlide(projectId: string, data: { artifactId: string; blockId: string }): Promise<ArtifactBlockSummary> {
  return request<ArtifactBlockSummary>(`/api/projects/${projectId}/artifacts/ppt/generate-slide`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function generateAllSlides(projectId: string, data: { artifactId: string }): Promise<ArtifactBlockSummary[]> {
  return request<ArtifactBlockSummary[]>(`/api/projects/${projectId}/artifacts/ppt/generate-all`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function generateDocSection(projectId: string, data: { artifactId: string; blockId: string }): Promise<ArtifactBlockSummary> {
  return request<ArtifactBlockSummary>(`/api/projects/${projectId}/artifacts/doc/generate-section`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createPPTArtifact(projectId: string, data: { title: string; topicSuggestions?: string[] }): Promise<{ artifact: ArtifactSummary; suggestions: string[] }> {
  return request<{ artifact: ArtifactSummary; suggestions: string[] }>(`/api/projects/${projectId}/artifacts/ppt/create`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createDocArtifact(projectId: string, data: { title: string; type: "docx" | "report" | "review"; outlineSections?: string[] }): Promise<ArtifactSummary> {
  return request<ArtifactSummary>(`/api/projects/${projectId}/artifacts/doc/create`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface VersionDiffResult {
  additions: Array<{ field: string; value: unknown }>;
  modifications: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  deletions: Array<{ field: string; value: unknown }>;
  summary: { added: number; modified: number; deleted: number };
}

export interface BlockDiffItem {
  index: number;
  changeType: "added" | "modified" | "removed" | "unchanged";
  oldBlock?: Record<string, unknown>;
  newBlock?: Record<string, unknown>;
}

export async function getVersionDiff(entityType: string, entityId: string, v1: string, v2: string): Promise<VersionDiffResult> {
  return request<VersionDiffResult>(`/api/versions/${entityType}/${entityId}/diff?v1=${v1}&v2=${v2}`);
}

export async function getArtifactBlockDiff(artifactId: string, fromVersionId: string, toVersionId: string): Promise<BlockDiffItem[]> {
  return request<BlockDiffItem[]>(`/api/artifacts/${artifactId}/blocks/diff?from=${fromVersionId}&to=${toVersionId}`);
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  educationStage?: string;
  discipline?: string;
  createdAt: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export async function register(data: { email: string; password: string; name: string; educationStage?: string | undefined; discipline?: string | undefined }): Promise<AuthResult> {
  return request<AuthResult>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function login(data: { email: string; password: string }): Promise<AuthResult> {
  return request<AuthResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMe(token: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function logout(token: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─────────────────────────────────────────────────────────────
// Domain Package API Functions (coaching, grad, research, undergrad, efficiency)
// ─────────────────────────────────────────────────────────────

// --- Coaching ---
export async function startDefenseSimulation(projectId: string, input: { paperContent?: string }) {
  return request<{ questions: Array<{ id: string; category: string; question: string; expectedPoints: string[]; difficulty: number }>; gateId: string; source: string }>(
    `/api/projects/${projectId}/coaching/defense/start`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function submitDefenseAnswer(projectId: string, input: { questionId: string; question: string; expectedPoints: string[]; answer: string }) {
  return request<{ score: number; strengths: string[]; weaknesses: string[]; suggestions: string[]; coveredPoints?: string[]; missedPoints?: string[] }>(
    `/api/projects/${projectId}/coaching/defense/answer`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function getSocraticQuestions(projectId: string, input: { topic: string; depth?: number; conversationHistory?: string[] }) {
  return request<Array<{ category: string; question: string; followUp: string }>>(
    `/api/projects/${projectId}/coaching/socratic`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function getMeetingBrief(projectId: string) {
  return request<{ meetingType: string; keyPoints: string[]; suggestedSlides: string[]; anticipatedQuestions: string[]; preparationChecklist: string[] }>(
    `/api/projects/${projectId}/coaching/meeting-brief`, { method: "POST", body: JSON.stringify({}) }
  );
}

export async function getDiagnosticReport(projectId: string) {
  return request<{ completionRate: number; averageDelayDays: number; riskAreas: string[]; strengths: string[]; aiInsights: string[]; retentionScore: number }>(
    `/api/projects/${projectId}/coaching/diagnostic`, { method: "POST", body: JSON.stringify({}) }
  );
}

export async function getProcrastinationHelp(projectId: string, input: { delayDays: number; taskTitle?: string }) {
  return request<{ tier: string; message: string; microTasks: Array<{ step: string; estimatedMinutes: number }> }>(
    `/api/projects/${projectId}/coaching/procrastination`, { method: "POST", body: JSON.stringify(input) }
  );
}

// --- Grad ---
export async function gradSubmissionCheck(projectId: string, input: { venue: string; content?: string; customRequirements?: string[] }) {
  return request<{ items: Array<{ name: string; met: boolean; detail: string }>; readiness: number; aiAnalysis: string[] }>(
    `/api/projects/${projectId}/grad/submission-check`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradReviewResponse(projectId: string, input: { rawReview: string; paperContent?: string }) {
  return request<{ comments: any[]; actionItems: any[]; responseLetter: any[]; overallStrategy: string; aiDraftSections: any[]; gateId?: string }>(
    `/api/projects/${projectId}/grad/review-response`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradExperimentLog(projectId: string, input: { log: any }) {
  return request<{ hasAnomaly: boolean; priority: number; issues: string[]; hypotheses: string[]; nextSteps: string[]; gateId?: string }>(
    `/api/projects/${projectId}/grad/experiment-log`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradGrantAnalysis(projectId: string, input: { application: any }) {
  return request<{ logicGaps: string[]; evidenceGaps: string[]; completeness: number; aiReview: string[]; gateId?: string }>(
    `/api/projects/${projectId}/grad/grant-analysis`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradResearchGaps(projectId: string, input?: { papers?: Array<{ title: string; limitations: string; futureWork: string }> }) {
  return request<{ gaps: Array<{ description: string; score: number }>; aiDirections: Array<{ direction: string; rationale: string; feasibility: number }>; gateId?: string }>(
    `/api/projects/${projectId}/grad/research-gaps`, { method: "POST", body: JSON.stringify(input ?? {}) }
  );
}

export async function gradCitationFix(projectId: string, input: { citations: string[] }) {
  return request<{ results: Array<{ original: string; fixed: string; style: string; confidence: number }> }>(
    `/api/projects/${projectId}/grad/citation-fix`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function gradAcademicTracker(projectId: string, input: { keywords: string[]; authors: string[]; venues: string[]; papers: Array<{ title: string; abstract: string; year: number }> }) {
  return request<{ digest: Array<{ title: string; relevance: number; summary: string; trends: string[] }> }>(
    `/api/projects/${projectId}/grad/academic-tracker`, { method: "POST", body: JSON.stringify(input) }
  );
}

// --- Research ---
export async function paperReadEnhanced(projectId: string, input: { sourceId: string; content: string }) {
  return request<any>(
    `/api/projects/${projectId}/research/paper-read-enhanced`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function paperCompareEnhanced(projectId: string, input: { papers: Array<{ title: string; content: string }> }) {
  return request<any>(
    `/api/projects/${projectId}/research/paper-compare-enhanced`, { method: "POST", body: JSON.stringify(input) }
  );
}

// --- Undergrad ---
export async function undergradSemesterPlan(projectId: string, input: { courses: any[]; semesterStart: string; semesterEnd: string }) {
  return request<any>(
    `/api/projects/${projectId}/undergrad/semester-plan`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradClassNotes(projectId: string, input: { rawTranscript: string; courseInfo?: { name: string; type: string; topics: string[] } }) {
  return request<any>(
    `/api/projects/${projectId}/undergrad/class-notes`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradSelfCheck(projectId: string, input: { content: string; options?: { minWords?: number; maxWords?: number; requiredSections?: string[] } }) {
  return request<any>(
    `/api/projects/${projectId}/undergrad/self-check`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradExamCrash(projectId: string, input: { sources: string[]; pastExams?: string[]; examDate: string; dailyHours: number }) {
  return request<any>(
    `/api/projects/${projectId}/undergrad/exam-crash`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradPPTBeautify(projectId: string, input: { slides: string[] }) {
  return request<any>(
    `/api/projects/${projectId}/undergrad/ppt-beautify`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function undergradGroupDivide(projectId: string, input: { members: any[]; taskDescriptions: string[]; totalHours: number }) {
  return request<any>(
    `/api/projects/${projectId}/undergrad/group-divide`, { method: "POST", body: JSON.stringify(input) }
  );
}

// --- Efficiency ---
export async function efficiencyTermbase(projectId: string, input: { action: string; [key: string]: any }) {
  return request<any>(
    `/api/projects/${projectId}/efficiency/termbase`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyFragments(projectId: string, input: { action: string; [key: string]: any }) {
  return request<any>(
    `/api/projects/${projectId}/efficiency/fragments`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyCrossProject(projectId: string, input: { action: string; [key: string]: any }) {
  return request<any>(
    `/api/projects/${projectId}/efficiency/cross-project`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyStyleUnify(projectId: string, input: { text: string; profile?: any }) {
  return request<any>(
    `/api/projects/${projectId}/efficiency/style-unify`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyDeduplicate(projectId: string, input: { items: string[]; threshold?: number }) {
  return request<any>(
    `/api/projects/${projectId}/efficiency/deduplicate`, { method: "POST", body: JSON.stringify(input) }
  );
}

export async function efficiencyFormatConvert(projectId: string, input: { content: string; from: string; to: string }) {
  return request<any>(
    `/api/projects/${projectId}/efficiency/format-convert`, { method: "POST", body: JSON.stringify(input) }
  );
}

// ─────────────────────────────────────────────────────────────
// SenseNova Integration (image generation, recognition, skills)
// ─────────────────────────────────────────────────────────────

export async function sensenovaListSkills() {
  return request<{ skills: Array<{ name: string; description: string }>; count: number }>(
    "/api/sensenova/skills"
  );
}

export async function sensenovaGetSkill(skillName: string) {
  return request<{ name: string; description: string; body: string; skillDir: string }>(
    `/api/sensenova/skills/${skillName}`
  );
}

export async function sensenovaGenerateImage(input: { prompt: string; size?: string; aspectRatio?: string; negativePrompt?: string; seed?: number }) {
  return request<{ imageUrl: string }>(
    "/api/sensenova/image/generate", { method: "POST", body: JSON.stringify(input) }
  );
}

export async function sensenovaRecognizeImage(input: { imageUrl: string; prompt?: string }) {
  return request<{ description: string }>(
    "/api/sensenova/image/recognize", { method: "POST", body: JSON.stringify(input) }
  );
}

export async function sensenovaImageSizes() {
  return request<{ sizes: Record<string, string> }>(
    "/api/sensenova/image/sizes"
  );
}
