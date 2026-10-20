import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { getGoalsWithProgress } from "@/lib/queries";
import { objectIdString } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function GoalPage({ params }: PageProps<"/goals/[id]">) {
  const { id } = await params;
  if (!objectIdString.safeParse(id).success) notFound();

  const [goal] = await getGoalsWithProgress({ id });
  if (!goal) notFound();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <header className="flex flex-col gap-1 rounded-xl border p-4">
        <Link href="/goals" className="text-xs text-muted-foreground hover:underline">
          ← 목표 목록
        </Link>
        <p className="text-sm text-muted-foreground">{goal.year}년 목표</p>
        <h1 className="text-xl font-semibold break-words">{goal.title}</h1>
        <ProgressBar percent={goal.percent} label={`${goal.title} 목표 진행률`} data-testid={`goal-progress-${goal.id}`} />
        <p className="text-xs text-muted-foreground">연결된 주간 계획 진행률의 평균입니다 (할 일이 없는 계획은 0%).</p>
      </header>

      <section aria-labelledby="linked-plans" className="flex flex-col gap-2">
        <h2 id="linked-plans" className="text-sm font-semibold">
          연결된 주간 계획 ({goal.plans.length})
        </h2>
        {goal.plans.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            연결된 주간 계획이 없습니다. 주간 계획 화면에서 이 목표를 연결할 수 있습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {goal.plans.map((plan) => (
              <li key={plan.id} className="flex flex-col gap-2 rounded-xl border p-4">
                <div className="flex flex-col gap-0.5">
                  <Link href={`/weekly/${plan.id}`} className="font-medium break-words hover:underline">
                    {plan.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {plan.startDate} ~ {plan.endDate}
                  </p>
                </div>
                <ProgressBar percent={plan.percent} label={`${plan.title} 진행률`} data-testid={`plan-progress-${plan.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
