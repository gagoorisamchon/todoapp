import Link from "next/link";
import { CarryOverDialog } from "@/components/CarryOverDialog";
import type { DashboardSummary } from "@/lib/queries";
import type { CarryOverCandidates } from "@/lib/services/carryOver";
import { DashboardCard } from "./Card";

type Props = {
  data: DashboardSummary["attention"];
  carry: Record<string, CarryOverCandidates>; // by last-week plan id, only plans with unfinished todos
};

export function AttentionCard({ data, carry }: Props) {
  const pending = data.lastWeekPlans.filter((p) => p.incomplete > 0);
  return (
    <DashboardCard id="dash-attention" title="확인 필요" testId="dashboard-attention">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>주간 계획에 연결되지 않은 할 일</span>
        <Link href="/board?view=week#unlinked-heading" className="font-semibold tabular-nums hover:underline">
          <span data-testid="unlinked-count">{data.unlinkedCount}</span>개
        </Link>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span>지난주 미완료 할 일</span>
          <span className="font-semibold tabular-nums">
            <span data-testid="lastweek-incomplete-count">{data.lastWeekIncomplete}</span>개
          </span>
        </div>
        {pending.length > 0 && (
          <ul className="flex flex-col gap-2">
            {pending.map((plan) => (
              <li
                key={plan.id}
                data-testid="lastweek-plan"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
              >
                <Link href={`/weekly/${plan.id}`} className="min-w-0 break-words hover:underline">
                  {plan.title} <span className="text-xs text-muted-foreground">미완료 {plan.incomplete}개</span>
                </Link>
                {carry[plan.id] ? <CarryOverDialog data={carry[plan.id]} /> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
