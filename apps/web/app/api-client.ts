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

export { listProjects as getProjects, checkWatcher as getWatcherChecks };
