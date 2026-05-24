import type { QuotaType, QuotaLimit, QuotaCheckResult } from "./types.js";

const PLAN_LIMITS: Record<string, Partial<Record<QuotaType, number>>> = {
  free: {
    file_parse: 10,
    export: 3,
    skill_invocation: 5,
    model_call: 50
  },
  student_pro: {
    file_parse: 100,
    export: 30,
    skill_invocation: 50,
    model_call: 500
  },
  research_pro: {
    file_parse: 500,
    export: 100,
    skill_invocation: 200,
    model_call: 2000
  }
};

const DEGRADATION_OPTIONS: Partial<Record<QuotaType, Array<{ label: string; description: string; savingsPercent: number }>>> = {
  file_parse: [
    { label: "轻解析 (只提取标题和摘要)", description: "只提取文档标题和摘要信息，跳过全文解析", savingsPercent: 50 },
    { label: "只解析选中文件", description: "仅解析用户选中的部分文件", savingsPercent: 80 },
    { label: "延后处理", description: "将解析任务推迟到非高峰时段处理", savingsPercent: 100 }
  ],
  long_context_call: [
    { label: "缩短上下文窗口", description: "减少上下文窗口大小以降低调用成本", savingsPercent: 40 },
    { label: "分批处理", description: "将大请求拆分为多个小批次处理", savingsPercent: 60 }
  ],
  export: [
    { label: "降低导出质量", description: "使用较低质量的导出设置", savingsPercent: 30 }
  ],
  skill_invocation: [
    { label: "使用基础 Skill 替代", description: "用基础 Skill 替代高级 Skill 调用", savingsPercent: 50 }
  ]
};

export class QuotaManager {
  private quotas: Map<string, QuotaLimit> = new Map();

  private key(userId: string, quotaType: QuotaType): string {
    return `${userId}:${quotaType}`;
  }

  private getOrCreateQuota(userId: string, quotaType: QuotaType): QuotaLimit {
    const k = this.key(userId, quotaType);
    const existing = this.quotas.get(k);
    if (existing) return existing;

    const planType = "free";
    const limitAmount = PLAN_LIMITS[planType]?.[quotaType] ?? 0;

    const quota: QuotaLimit = {
      quotaType,
      usedAmount: 0,
      limitAmount,
      resetAt: null,
      planType
    };
    this.quotas.set(k, quota);
    return quota;
  }

  checkQuota(userId: string, quotaType: QuotaType, requestedAmount: number): QuotaCheckResult {
    const quota = this.getOrCreateQuota(userId, quotaType);
    const remaining = Math.max(0, quota.limitAmount - quota.usedAmount);
    const allowed = remaining >= requestedAmount;

    return {
      allowed,
      quotaType,
      remaining,
      usedAmount: quota.usedAmount,
      limitAmount: quota.limitAmount,
      degradationOptions: allowed ? [] : (DEGRADATION_OPTIONS[quotaType] ?? [])
    };
  }

  consumeQuota(userId: string, quotaType: QuotaType, amount: number): void {
    const quota = this.getOrCreateQuota(userId, quotaType);
    quota.usedAmount += amount;
    this.quotas.set(this.key(userId, quotaType), quota);
  }

  getDegradationOptions(quotaType: QuotaType): Array<{ label: string; description: string; savingsPercent: number }> {
    return DEGRADATION_OPTIONS[quotaType] ?? [];
  }

  setPlan(userId: string, planType: string): void {
    const limits = PLAN_LIMITS[planType];
    if (!limits) return;

    for (const [qt, limitAmount] of Object.entries(limits)) {
      const quota = this.getOrCreateQuota(userId, qt as QuotaType);
      quota.limitAmount = limitAmount;
      quota.planType = planType as QuotaLimit["planType"];
      this.quotas.set(this.key(userId, qt as QuotaType), quota);
    }
  }
}
