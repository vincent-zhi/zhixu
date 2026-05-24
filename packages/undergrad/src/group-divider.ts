import type { GroupDivision, GroupMember, GroupAssignment, ContributionEntry } from "./types.js";

export class GroupDivider {
  divideTask(input: {
    taskTitle: string;
    members: GroupMember[];
    totalDifficulty: number;
    deadline: string;
  }): GroupDivision {
    const { taskTitle, members, totalDifficulty } = input;

    const totalWeight = members.reduce((sum, m) => sum + m.assignedWeight, 0);

    const assignments: GroupAssignment[] = members.map((member) => {
      const share = totalWeight > 0 ? member.assignedWeight / totalWeight : 1 / members.length;
      const memberDifficulty = Math.round(totalDifficulty * share);
      const taskCount = Math.max(1, Math.ceil(memberDifficulty / 3));
      const taskIds: string[] = [];
      for (let i = 0; i < taskCount; i++) {
        taskIds.push(crypto.randomUUID());
      }

      return {
        memberId: member.id,
        taskIds,
        estimatedHours: Math.round(memberDifficulty * 1.5),
        difficulty: memberDifficulty,
      };
    });

    return {
      id: crypto.randomUUID(),
      projectId: "",
      taskTitle,
      members,
      assignments,
      contributionReport: [],
    };
  }

  generateContributionReport(
    division: GroupDivision,
    completedTasks: Map<string, { hours: number; quality: number }>,
  ): ContributionEntry[] {
    const entries: ContributionEntry[] = [];
    let totalContribution = 0;

    for (const member of division.members) {
      const data = completedTasks.get(member.id);
      const completedTasksCount = data ? Math.ceil(data.hours / 2) : 0;
      const totalHours = data?.hours ?? 0;
      const qualityScore = data?.quality ?? 0;
      const rawContribution = completedTasksCount * qualityScore;
      totalContribution += rawContribution;

      entries.push({
        memberId: member.id,
        completedTasks: completedTasksCount,
        totalHours,
        qualityScore,
        contributionPercent: 0,
      });
    }

    if (totalContribution > 0) {
      for (const entry of entries) {
        const raw = entry.completedTasks * entry.qualityScore;
        entry.contributionPercent = Math.round((raw / totalContribution) * 100);
      }
    } else if (entries.length > 0) {
      const equalShare = Math.round(100 / entries.length);
      for (const entry of entries) {
        entry.contributionPercent = equalShare;
      }
    }

    return entries;
  }
}
