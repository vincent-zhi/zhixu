import type { ProjectShare, ShareLink } from "./types.js";

export interface SharingStore {
  getShares(projectId: string): Promise<ShareLink[]>;
  saveShare(share: ShareLink): Promise<void>;
  deleteShare(shareId: string): Promise<void>;
}

export class ProjectSharingManager {
  private shares = new Map<string, ProjectShare>();

  constructor(private store?: SharingStore) {}

  async createShare(input: {
    projectId: string;
    sharedBy: string;
    shareType: ProjectShare["shareType"];
    recipientIds: string[];
    expiresAt?: string;
  }): Promise<ProjectShare> {
    const share: ProjectShare = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      sharedBy: input.sharedBy,
      shareType: input.shareType,
      recipientIds: input.recipientIds,
      expiresAt: input.expiresAt ?? null,
      createdAt: new Date().toISOString(),
    };

    if (this.store) {
      await this.store.saveShare(share);
    } else {
      this.shares.set(share.id, share);
    }

    return share;
  }

  async revokeShare(shareId: string): Promise<boolean> {
    if (this.store) {
      const exists = this.shares.has(shareId);
      await this.store.deleteShare(shareId);
      this.shares.delete(shareId);
      return exists;
    }
    return this.shares.delete(shareId);
  }

  getShare(shareId: string): ProjectShare | undefined {
    return this.shares.get(shareId);
  }

  async listSharesByProject(projectId: string): Promise<ProjectShare[]> {
    if (this.store) {
      return this.store.getShares(projectId);
    }
    return [...this.shares.values()].filter((s) => s.projectId === projectId);
  }

  listSharesByUser(userId: string): ProjectShare[] {
    return [...this.shares.values()].filter(
      (s) => s.recipientIds.includes(userId) || s.sharedBy === userId
    );
  }

  checkAccess(shareId: string, userId: string): boolean {
    const share = this.shares.get(shareId);
    if (!share) return false;

    if (share.expiresAt) {
      const expiresAt = new Date(share.expiresAt).getTime();
      if (Date.now() > expiresAt) return false;
    }

    return share.sharedBy === userId || share.recipientIds.includes(userId);
  }

  checkProjectAccess(projectId: string, userId: string): ProjectShare | undefined {
    for (const share of this.shares.values()) {
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
