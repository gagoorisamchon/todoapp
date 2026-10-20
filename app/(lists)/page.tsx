import Link from "next/link";
import { AttentionCard } from "@/components/dashboard/AttentionCard";
import { GoalsCard } from "@/components/dashboard/GoalsCard";
import { TodayCard } from "@/components/dashboard/TodayCard";
import { WeekCard } from "@/components/dashboard/WeekCard";
import { buttonVariants } from "@/components/ui/button";
import { getDashboardSummary } from "@/lib/queries";
import { getCarryOverCandidates, type CarryOverCandidates } from "@/lib/services/carryOver";

export const dynamic = "force-dynamic";

// Dashboard, the first screen (PLAN 단계 7): numbers and ProgressBar only.
export default async function Home() {
  const summary = await getDashboardSummary();
  const pending = summary.attention.lastWeekPlans.filter((p) => p.incomplete > 0);
  const carry: Record<string, CarryOverCandidates> = {};
  for (const data of await Promise.all(pending.map((p) => getCarryOverCandidates(p.id)))) {
    if (data) carry[data.source.id] = data;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">대시보드</h1>
      {summary.isEmpty && (
        // PRD.md:14 flow: goal -> weekly plan -> todo.
        <section
          aria-labelledby="dash-empty"
          data-testid="dashboard-empty"
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center"
        >
          <h2 id="dash-empty" className="text-lg font-semibold">
            먼저 1년 목표를 만들어 보세요
          </h2>
          <p className="text-sm text-muted-foreground">
            1년 목표 → 주간 계획 → 오늘 할 일 순서로 연결하면 진행률이 자동으로 계산됩니다.
          </p>
          <Link href="/goals" className={buttonVariants({ size: "lg" })}>
            1년 목표 만들기
          </Link>
        </section>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <TodayCard today={summary.today} data={summary.todayCard} />
        <WeekCard data={summary.week} />
        <GoalsCard data={summary.goals} />
        <AttentionCard data={summary.attention} carry={carry} />
      </div>
    </main>
  );
}
