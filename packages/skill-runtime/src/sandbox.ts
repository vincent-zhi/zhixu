export const DENIED_BY_DEFAULT = [
  "read_all_files",
  "read_clipboard",
  "access_cookies",
  "access_secrets",
  "delete_files",
  "send_files_external",
  "execute_arbitrary_commands",
  "call_paid_apis",
  "access_other_projects"
] as const;

export const HIGH_RISK_BLACKLIST = [
  "auto_submit_assignment",
  "auto_submit_paper",
  "auto_send_email",
  "auto_download_restricted",
  "execute_unreviewed_code",
  "upload_unpublished_to_third_party"
] as const;

export class SandboxPolicy {
  isDeniedByDefault(scope: string): boolean {
    return (DENIED_BY_DEFAULT as readonly string[]).includes(scope);
  }

  isHighRiskBlacklisted(scope: string): boolean {
    return (HIGH_RISK_BLACKLIST as readonly string[]).includes(scope);
  }

  validateScope(scope: string): { allowed: boolean; reason?: string } {
    if (this.isHighRiskBlacklisted(scope)) {
      return { allowed: false, reason: "HIGH_RISK_BLACKLISTED" };
    }
    if (this.isDeniedByDefault(scope)) {
      return { allowed: false, reason: "DENIED_BY_DEFAULT" };
    }
    return { allowed: true };
  }
}
