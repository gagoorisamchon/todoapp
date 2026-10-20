import { GoalList } from "@/components/goals/GoalList";
import { todayKey, yearOf } from "@/lib/date";
import { getGoalsWithProgress } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Goal % follows R6 (mean of raw weekly values, rounded once).
export default async function GoalsPage() {
  const goals = await getGoalsWithProgress();
  // The client list only needs the plan count, not the plans themselves.
  const rows = goals.map(({ plans, ...goal }) => ({ ...goal, planCount: plans.length }));
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <GoalList goals={rows} defaultYear={yearOf(todayKey())} />
    </main>
  );
}
