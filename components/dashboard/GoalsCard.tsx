import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import type { DashboardSummary } from "@/lib/queries";
import { DashboardCard } from "./Card";

export function GoalsCard({ data }: { data: DashboardSummary["goals"] }) {
  return (
    <DashboardCard id="dash-goals" title={`${data.year}년 목표`} href="/goals" linkLabel="목표" testId="dashboard-goals">
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{data.year}년 목표가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((goal) => (
            <li key={goal.id} data-testid="dashboard-goal" className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/goals/${goal.id}`} className="min-w-0 text-sm font-medium break-words hover:underline">
                  {goal.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground" data-testid={`goal-plan-count-${goal.id}`}>
                  주간 계획 {goal.planCount}개
                </span>
              </div>
              {/* R6 goal progress */}
              <ProgressBar percent={goal.percent} label={`${goal.title} 목표 진행률`} data-testid={`goal-progress-${goal.id}`} />
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
