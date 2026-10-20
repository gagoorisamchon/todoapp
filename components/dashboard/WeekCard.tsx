import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { weekEnd } from "@/lib/date";
import type { DashboardSummary } from "@/lib/queries";
import { DashboardCard } from "./Card";

export function WeekCard({ data }: { data: DashboardSummary["week"] }) {
  return (
    <DashboardCard
      id="dash-week"
      title={`이번 주 (${data.monday} ~ ${weekEnd(data.monday)})`}
      href="/weekly"
      linkLabel="주간 계획"
      testId="dashboard-week"
    >
      {data.plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">이번 주에 시작하는 주간 계획이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.plans.map((plan) => (
            <li key={plan.id} data-testid="dashboard-week-plan" className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/weekly/${plan.id}`} className="min-w-0 text-sm font-medium break-words hover:underline">
                  {plan.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {plan.done} / {plan.total}
                </span>
              </div>
              <ProgressBar percent={plan.percent} label={`${plan.title} 진행률`} data-testid={`plan-progress-${plan.id}`} />
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
