import type { ProjectShare } from "./types.js";

const shares = new Map<string, ProjectShare>();

export class ProjectSharingManager {
  createShare(input: {
    projectId: string;
    sharedBy: string;
    shareType: ProjectShare["shareType"];
    recipientIds: string[];
    expiresAt?: string;
  }): ProjectShare {
    const share: ProjectShare = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      sharedBy: input.sharedBy,
      shareType: input.shareType,
      recipientIds: input.recipientIds,
      expiresAt: input.expiresAt ?? null,
      createdAt: new Date().toISOString(),
    };
    shares.set(share.id, share);
    return share;
  }

  revokeShare(shareId: string): boolean {
    return shares.delete(shareId);
  }

  checkAccess(shareId: string, userId: string): boolean {
    const share = shares.get(shareId);
    if (!share) return false;

    if (share.expiresAt) {
      const expiresAt = new Date(share.expiresAt).getTime();
      if (Date.now() > expiresAt) return false;
    }

    return share.recipientIds.includes(userId);
  }
}
