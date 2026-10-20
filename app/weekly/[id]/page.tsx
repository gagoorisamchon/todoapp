import Link from "next/link";
import { notFound } from "next/navigation";
import { CarryOverDialog } from "@/components/CarryOverDialog";
import { Board } from "@/components/kanban/Board";
import { ProgressBar } from "@/components/ProgressBar";
import { connectDB } from "@/lib/db";
import { getWeeklyPlansWithProgress, listTodos } from "@/lib/queries";
import { getCarryOverCandidates } from "@/lib/services/carryOver";
import { getGoal } from "@/lib/services/goals";
import { objectIdString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function WeeklyPlanPage({ params }: PageProps<"/weekly/[id]">) {
  const { id } = await params;
  if (!objectIdString.safeParse(id).success) notFound();

  await connectDB();
  const [plans, todos, carry] = await Promise.all([
    getWeeklyPlansWithProgress(),
    listTodos({ weeklyPlanId: id }),
    getCarryOverCandidates(id),
  ]);
  const plan = plans.find((p) => p.id === id);
  if (!plan || !carry) notFound();
  const goal = plan.goalId ? await getGoal(plan.goalId) : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col gap-2 rounded-xl border p-4">
        <Link href="/weekly" className="text-xs text-muted-foreground hover:underline">
          ← 주간 계획 목록
        </Link>
        <h1 className="text-xl font-semibold break-words">{plan.title}</h1>
        <p className="text-sm text-muted-foreground">
          {plan.startDate} ~ {plan.endDate}
        </p>
        <p className="text-sm">
          {goal ? (
            <Link href={`/goals/${goal.id}`} className="hover:underline">
              목표: {goal.title} ({goal.year})
            </Link>
          ) : (
            <span className="text-muted-foreground">목표 없음</span>
          )}
        </p>
        <ProgressBar percent={plan.percent} label={`${plan.title} 진행률`} data-testid={`plan-progress-${plan.id}`} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            완료 {plan.done} / 전체 {plan.total}
          </p>
          <CarryOverDialog data={carry} />
        </div>
      </header>
      {/* Only this plan's todos; plans are passed in full so the todo form can still relink. */}
      <Board todos={todos} plans={plans} title="이 계획의 할 일" defaultPlan={plan} />
    </main>
  );
}
