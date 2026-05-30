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

  getShare(shareId: string): ProjectShare | undefined {
    return shares.get(shareId);
  }

  listSharesByProject(projectId: string): ProjectShare[] {
    return [...shares.values()].filter((s) => s.projectId === projectId);
  }

  listSharesByUser(userId: string): ProjectShare[] {
    return [...shares.values()].filter(
      (s) => s.recipientIds.includes(userId) || s.sharedBy === userId
    );
  }

  checkAccess(shareId: string, userId: string): boolean {
    const share = shares.get(shareId);
    if (!share) return false;

    if (share.expiresAt) {
      const expiresAt = new Date(share.expiresAt).getTime();
      if (Date.now() > expiresAt) return false;
    }

    return share.sharedBy === userId || share.recipientIds.includes(userId);
  }

  checkProjectAccess(projectId: string, userId: string): ProjectShare | undefined {
    for (const share of shares.values()) {
      if (share.projectId !== projectId) continue;

      if (share.expiresAt) {
        const expiresAt = new Date(share.expiresAt).getTime();
        if (Date.now() > expiresAt) continue;
      }

      if (share.sharedBy === userId || share.recipientIds.includes(userId)) {
        return share;
      }
    }
    return undefined;
  }
}
