export interface CanvasBlock {
  id: string;
  artifactId: string;
  blockType: "heading" | "paragraph" | "table" | "figure" | "citation" | "formula" | "checklist" | "slide" | "code";
  contentJson: Record<string, unknown>;
  orderIndex: number;
  responsibilityColor: "green" | "yellow" | "gray";
  verificationStatus: "verified" | "needs_review" | "unverified";
  evidenceRefs: string[];
  comments: CanvasComment[];
  versionId: string | null;
  parentId: string | null;
  childrenIds: string[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasComment {
  id: string;
  blockId: string;
  authorId: string;
  content: string;
  resolved: boolean;
  createdAt: string;
}

export interface CanvasOperation {
  id: string;
  artifactId: string;
  blockId: string;
  operationType: "insert" | "update" | "delete" | "move" | "bind_evidence" | "add_comment" | "ai_command";
  payload: Record<string, unknown>;
  userId: string;
  timestamp: string;
}

export interface StreamingState {
  artifactId: string;
  status: "idle" | "streaming" | "paused" | "completed" | "error";
  currentBlockId: string | null;
  progress: number;
  branchPoint: string | null;
}

export type InlineAICommand =
  | "shorten"
  | "expand"
  | "academicize"
  | "add_example"
  | "add_citation"
  | "reduce_similarity"
  | "convert_to_slide"
  | "generate_speaker_notes"
  | "summarize"
  | "translate";

export interface CanvasDocument {
  id: string;
  artifactId: string;
  title: string;
  blocks: CanvasBlock[];
  outline: OutlineNode[];
  streamingState: StreamingState;
  createdAt: string;
  updatedAt: string;
}

export interface OutlineNode {
  id: string;
  blockId: string;
  title: string;
  level: number;
  children: OutlineNode[];
  orderIndex: number;
}
