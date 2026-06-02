export interface ProjectShare {
  id: string;
  projectId: string;
  sharedBy: string;
  shareType: "read_only" | "comment" | "edit";
  recipientIds: string[];
  expiresAt: string | null;
  createdAt: string;
}

export type ShareLink = ProjectShare;

export interface SharedKnowledgebase {
  id: string;
  workspaceId: string;
  name: string;
  entries: KnowledgebaseEntry[];
  accessPolicy: "lab_only" | "course_only" | "team_only" | "public";
  createdAt: string;
}

export interface KnowledgebaseEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  contributedBy: string;
  sensitive: boolean;
  createdAt: string;
}

export interface ProgressBoard {
  id: string;
  projectId: string;
  columns: ProgressColumn[];
  lastUpdated: string;
}

export interface ProgressColumn {
  id: string;
  title: string;
  taskIds: string[];
  orderIndex: number;
}

export interface ContributionReport {
  id: string;
  projectId: string;
  period: { start: string; end: string };
  members: MemberContribution[];
  summary: string;
}

export interface MemberContribution {
  memberId: string;
  memberName: string;
  tasksCompleted: number;
  tasksTotal: number;
  artifactsContributed: number;
  blocksEdited: number;
  hoursEstimated: number;
  contributionPercent: number;
}
