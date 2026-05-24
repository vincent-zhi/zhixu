import type { ContributionReport, MemberContribution } from "./types.js";

export class ContributionTracker {
  generateReport(input: {
    projectId: string;
    period: { start: string; end: string };
    members: Array<{ id: string; name: string }>;
    activities: Array<{
      memberId: string;
      type: "task_completed" | "artifact_created" | "block_edited";
      hoursSpent: number;
    }>;
  }): ContributionReport {
    const { projectId, period, members, activities } = input;

    const memberActivities = new Map<string, typeof activities>();
    for (const activity of activities) {
      const existing = memberActivities.get(activity.memberId) ?? [];
      existing.push(activity);
      memberActivities.set(activity.memberId, existing);
    }

    const totalHours = activities.reduce((sum, a) => sum + a.hoursSpent, 0);

    const memberContributions: MemberContribution[] = members.map((member) => {
      const acts = memberActivities.get(member.id) ?? [];
      const tasksCompleted = acts.filter((a) => a.type === "task_completed").length;
      const artifactsContributed = acts.filter((a) => a.type === "artifact_created").length;
      const blocksEdited = acts.filter((a) => a.type === "block_edited").length;
      const hoursEstimated = acts.reduce((sum, a) => sum + a.hoursSpent, 0);

      const totalActivities = acts.length;
      const contributionPercent = activities.length > 0
        ? (totalActivities / activities.length) * 100
        : 0;

      const tasksTotal = tasksCompleted + acts.filter((a) => a.type !== "task_completed").length;

      return {
        memberId: member.id,
        memberName: member.name,
        tasksCompleted,
        tasksTotal: tasksTotal > 0 ? tasksTotal : tasksCompleted,
        artifactsContributed,
        blocksEdited,
        hoursEstimated,
        contributionPercent,
      };
    });

    const topContributor = memberContributions.reduce(
      (top, mc) => (mc.contributionPercent > (top?.contributionPercent ?? 0) ? mc : top),
      memberContributions[0] ?? null
    );

    const summary = topContributor
      ? `Top contributor: ${topContributor.memberName} (${topContributor.contributionPercent.toFixed(1)}%). Total hours: ${totalHours.toFixed(1)}.`
      : "No contributions recorded.";

    return {
      id: crypto.randomUUID(),
      projectId,
      period,
      members: memberContributions,
      summary,
    };
  }
}
