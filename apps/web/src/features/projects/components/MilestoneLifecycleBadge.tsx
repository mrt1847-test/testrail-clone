import type { MilestoneLifecycleStatus } from "../api/planningApi";
import { milestoneStatusClass, milestoneStatusLabel } from "../utils/milestoneDisplay";

type MilestoneLifecycleBadgeProps = {
  status: MilestoneLifecycleStatus;
};

export function MilestoneLifecycleBadge({ status }: MilestoneLifecycleBadgeProps) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${milestoneStatusClass(status)}`}>
      {milestoneStatusLabel(status)}
    </span>
  );
}
