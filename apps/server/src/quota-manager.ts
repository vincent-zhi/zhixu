export interface QuotaCheckResult {
  allowed: boolean;
  quotaType: string;
  usedAmount: number;
  limitAmount: number;
  remainingAmount: number;
  degradationOptions: string[];
}

const DEFAULT_QUOTAS: Record<string, number> = {
  parse_source: 50,
  long_context: 20,
  export: 30,
  skill_invocation: 100,
};

const DEGRADATION_OPTIONS: Record<string, string[]> = {
  parse_source: ["light_parse", "selected_files_only", "defer_processing", "upgrade_plan", "manual_summary"],
  long_context: ["shorter_context", "split_document", "upgrade_plan"],
  export: ["reduce_format_options", "upgrade_plan"],
  skill_invocation: ["use_basic_skill", "defer_to_off_peak", "upgrade_plan"],
};

export class QuotaManager {
  private readonly quotas = new Map<string, { usedAmount: number; limitAmount: number; resetAt: string | null }>();

  private quotaKey(userId: string, quotaType: string): string {
    return `${userId}:${quotaType}`;
  }

  checkQuota(userId: string, quotaType: string, requestedAmount: number): QuotaCheckResult {
    const key = this.quotaKey(userId, quotaType);
    const entry = this.quotas.get(key);
    const limitAmount = entry?.limitAmount ?? DEFAULT_QUOTAS[quotaType] ?? 0;
    const usedAmount = entry?.usedAmount ?? 0;
    const remainingAmount = Math.max(0, limitAmount - usedAmount);
    const allowed = remainingAmount >= requestedAmount;

    return {
      allowed,
      quotaType,
      usedAmount,
      limitAmount,
      remainingAmount,
      degradationOptions: allowed ? [] : this.getDegradationOptions(quotaType),
    };
  }

  consumeQuota(userId: string, quotaType: string, amount: number): QuotaCheckResult {
    const key = this.quotaKey(userId, quotaType);
    const entry = this.quotas.get(key);
    const limitAmount = entry?.limitAmount ?? DEFAULT_QUOTAS[quotaType] ?? 0;
    const usedAmount = entry?.usedAmount ?? 0;
    const remainingAmount = Math.max(0, limitAmount - usedAmount);
    const allowed = remainingAmount >= amount;

    if (allowed) {
      this.quotas.set(key, {
        usedAmount: usedAmount + amount,
        limitAmount,
        resetAt: entry?.resetAt ?? null,
      });
    }

    return {
      allowed,
      quotaType,
      usedAmount: allowed ? usedAmount + amount : usedAmount,
      limitAmount,
      remainingAmount: allowed ? remainingAmount - amount : remainingAmount,
      degradationOptions: allowed ? [] : this.getDegradationOptions(quotaType),
    };
  }

  setQuota(userId: string, quotaType: string, limitAmount: number, resetAt?: string): void {
    const key = this.quotaKey(userId, quotaType);
    const entry = this.quotas.get(key);
    this.quotas.set(key, {
      usedAmount: entry?.usedAmount ?? 0,
      limitAmount,
      resetAt: resetAt ?? entry?.resetAt ?? null,
    });
  }

  getDegradationOptions(quotaType: string): string[] {
    return DEGRADATION_OPTIONS[quotaType] ?? [];
  }

  resetQuota(userId: string, quotaType: string): void {
    const key = this.quotaKey(userId, quotaType);
    const entry = this.quotas.get(key);
    if (entry) {
      this.quotas.set(key, {
        usedAmount: 0,
        limitAmount: entry.limitAmount,
        resetAt: entry.resetAt,
      });
    }
  }
}
