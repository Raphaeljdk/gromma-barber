import type { ClubMemberConfig, ErpWorkspace } from "./erp-workspace";

/** Resolves access on the effective date without deleting historical records. */
export function effectiveClubMember(member: ClubMemberConfig, now: Date): ClubMemberConfig {
  const result = { ...member };
  const nowMs = now.getTime();
  if (result.cancelEffectiveAt && new Date(result.cancelEffectiveAt).getTime() <= nowMs) {
    result.status = "CANCELED";
    result.canceledAt = result.cancelEffectiveAt;
  } else if (result.pendingPlanId && new Date(result.nextBillingAt).getTime() <= nowMs) {
    result.planId = result.pendingPlanId;
  }
  return result;
}

/** Applied during a tenant's billing reconciliation; idempotent by member and event. */
export function applyClubLifecycle(workspace: ErpWorkspace, now: Date): number {
  let changed = 0;
  for (const member of workspace.clubMembers) {
    if (member.status === "CANCELED") continue;
    if (member.cancelEffectiveAt && new Date(member.cancelEffectiveAt).getTime() <= now.getTime()) {
      member.status = "CANCELED";
      member.canceledAt = member.cancelEffectiveAt;
      member.pendingPlanId = undefined;
      const event = [...workspace.clubEvents].reverse().find(e => e.memberId === member.id && e.kind === "CANCEL" && e.status === "SCHEDULED");
      if (event) event.status = "APPLIED";
      changed++;
      continue;
    }
    if (member.pendingPlanId && new Date(member.nextBillingAt).getTime() <= now.getTime()) {
      const plan = workspace.clubPlans.find(p => p.id === member.pendingPlanId);
      if (!plan) continue;
      const event = [...workspace.clubEvents].reverse().find(e => e.memberId === member.id && e.kind === "CHANGE" && e.status === "SCHEDULED");
      member.planId = plan.id;
      member.pendingPlanId = undefined;
      member.pendingPlanRequestedAt = undefined;
      if (event) event.status = "APPLIED";
      changed++;
    }
  }
  return changed;
}

/** Fidelidade conta da primeira contratação, sem reiniciar nas trocas de plano. */
export function completedLoyaltyMonths(member: ClubMemberConfig, now: Date, months = 3): boolean {
  const from = new Date(member.startedAt);
  if (!Number.isFinite(from.getTime())) return false;
  const end = new Date(from);
  end.setUTCMonth(end.getUTCMonth() + months);
  return now.getTime() >= end.getTime();
}
