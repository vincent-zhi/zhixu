import type { OfflineCacheManager } from "./offline-cache.js";

export interface ProjectPreloadData {
  tasks?: unknown[];
  summary?: unknown;
  outlines?: unknown[];
  errors?: unknown[];
  flashcards?: unknown[];
  reviewPlan?: unknown;
}

export class EntityCacheViews {
  constructor(private cache: OfflineCacheManager) {}

  async cacheTasks(projectId: string, tasks: unknown[]): Promise<void> {
    await this.cache.set(`tasks:${projectId}`, tasks);
  }

  async getCachedTasks(projectId: string): Promise<unknown[] | null> {
    const entry = await this.cache.get(`tasks:${projectId}`);
    return entry ? (entry.data as unknown[]) : null;
  }

  async cacheProjectSummary(projectId: string, summary: unknown): Promise<void> {
    await this.cache.set(`summary:${projectId}`, summary);
  }

  async getCachedProjectSummary(projectId: string): Promise<unknown | null> {
    const entry = await this.cache.get(`summary:${projectId}`);
    return entry ? entry.data : null;
  }

  async cacheOutlines(projectId: string, outlines: unknown[]): Promise<void> {
    await this.cache.set(`outlines:${projectId}`, outlines);
  }

  async getCachedOutlines(projectId: string): Promise<unknown[] | null> {
    const entry = await this.cache.get(`outlines:${projectId}`);
    return entry ? (entry.data as unknown[]) : null;
  }

  async cacheErrorBook(projectId: string, errors: unknown[]): Promise<void> {
    await this.cache.set(`errors:${projectId}`, errors);
  }

  async getCachedErrorBook(projectId: string): Promise<unknown[] | null> {
    const entry = await this.cache.get(`errors:${projectId}`);
    return entry ? (entry.data as unknown[]) : null;
  }

  async cacheFlashcards(projectId: string, cards: unknown[]): Promise<void> {
    await this.cache.set(`flashcards:${projectId}`, cards);
  }

  async getCachedFlashcards(projectId: string): Promise<unknown[] | null> {
    const entry = await this.cache.get(`flashcards:${projectId}`);
    return entry ? (entry.data as unknown[]) : null;
  }

  async cacheReviewPlan(projectId: string, plan: unknown): Promise<void> {
    await this.cache.set(`review-plan:${projectId}`, plan);
  }

  async getCachedReviewPlan(projectId: string): Promise<unknown | null> {
    const entry = await this.cache.get(`review-plan:${projectId}`);
    return entry ? entry.data : null;
  }

  async preloadProject(projectId: string, data: ProjectPreloadData): Promise<void> {
    const entries: Array<Promise<void>> = [];
    if (data.tasks) entries.push(this.cacheTasks(projectId, data.tasks));
    if (data.summary) entries.push(this.cacheProjectSummary(projectId, data.summary));
    if (data.outlines) entries.push(this.cacheOutlines(projectId, data.outlines));
    if (data.errors) entries.push(this.cacheErrorBook(projectId, data.errors));
    if (data.flashcards) entries.push(this.cacheFlashcards(projectId, data.flashcards));
    if (data.reviewPlan) entries.push(this.cacheReviewPlan(projectId, data.reviewPlan));
    await Promise.all(entries);
  }

  async invalidateProject(projectId: string): Promise<void> {
    const keys = [
      `tasks:${projectId}`,
      `summary:${projectId}`,
      `outlines:${projectId}`,
      `errors:${projectId}`,
      `flashcards:${projectId}`,
      `review-plan:${projectId}`,
    ];
    for (const key of keys) {
      await this.cache.delete(key);
    }
  }
}
