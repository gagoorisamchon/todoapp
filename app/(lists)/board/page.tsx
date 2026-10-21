import Link from "next/link";
import { Board } from "@/components/kanban/Board";
import { ProgressBar } from "@/components/ProgressBar";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { addDaysKey, addYearsKey, todayKey } from "@/lib/date";
import { getBoardData, type BoardView } from "@/lib/queries";
import { boardViewParam, dateKeyString } from "@/lib/validation";

export const dynamic = "force-dynamic";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function step(view: BoardView, date: string, dir: 1 | -1): string {
  if (view === "all") return date; // no prev/next in the all view
  if (view === "day") return addDaysKey(date, dir);
  if (view === "week") return addDaysKey(date, 7 * dir);
  return addYearsKey(date, dir);
}

// /board?view=all|day|week|year&date=YYYY-MM-DD; a missing or invalid view falls back to the all view,
// a missing or invalid date to today (PLAN 단계 6.3).
export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const params = await searchParams;
  const today = todayKey();
  const view = boardViewParam.parse(first(params.view));
  const date = dateKeyString.catch(today).parse(first(params.date));
  const data = await getBoardData(view, date);

  const rangeLabel =
    data.view === "all"
      ? "전체 할 일"
      : data.view === "day"
        ? data.date
        : data.view === "week"
          ? `${data.from} ~ ${data.to}`
          : `${data.year}년`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <ViewSwitcher
        view={view}
        date={date}
        rangeLabel={rangeLabel}
        prevDate={step(view, date, -1)}
        nextDate={step(view, date, 1)}
        today={today}
      />

      {data.view === "week" && (
        <section aria-labelledby="week-plans-heading" data-testid="week-plans" className="flex flex-col gap-2">
          <h2 id="week-plans-heading" className="text-sm font-semibold">
            이 주의 주간 계획 ({data.weekPlans.length})
          </h2>
          {data.weekPlans.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              이 주에 시작하는 주간 계획이 없습니다.
            </p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {data.weekPlans.map((plan) => (
                <li key={plan.id} data-testid="week-plan" className="flex flex-col gap-2 rounded-xl border p-3">
                  <Link href={`/weekly/${plan.id}`} className="font-medium break-words hover:underline">
                    {plan.title}
                  </Link>
                  <ProgressBar percent={plan.percent} label={`${plan.title} 진행률`} data-testid={`plan-progress-${plan.id}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data.view === "year" ? (
        <section aria-labelledby="year-heading" data-testid="year-tree" className="flex flex-col gap-3">
          <h1 id="year-heading" className="text-xl font-semibold">
            {data.year}년 목표
          </h1>
          {data.goals.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {data.year}년 목표가 없습니다. 목표 화면에서 만들 수 있습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.goals.map((goal) => (
                <li key={goal.id} data-testid="year-goal" className="flex flex-col gap-2 rounded-xl border p-4">
                  <Link href={`/goals/${goal.id}`} className="font-semibold break-words hover:underline">
                    {goal.title}
                  </Link>
                  <ProgressBar percent={goal.percent} label={`${goal.title} 목표 진행률`} data-testid={`goal-progress-${goal.id}`} />
                  {goal.plans.length === 0 ? (
                    <p className="pl-4 text-xs text-muted-foreground">연결된 주간 계획이 없습니다.</p>
                  ) : (
                    <ul className="flex flex-col gap-2 border-l pl-4">
                      {goal.plans.map((plan) => (
                        <li key={plan.id} data-testid="year-plan" className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <Link href={`/weekly/${plan.id}`} className="text-sm break-words hover:underline">
                              {plan.title}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {plan.startDate} ~ {plan.endDate}
                            </span>
                          </div>
                          <ProgressBar percent={plan.percent} label={`${plan.title} 진행률`} data-testid={`plan-progress-${plan.id}`} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        // Unlinked todos of the same range are listed separately; the kanban still shows every todo in range.
        // `range` lets the board tell the user when a saved todo falls outside what is shown (all view: no range).
        <Board
          todos={data.todos}
          plans={data.plans}
          defaultDate={data.view === "day" ? date : undefined}
          range={data.view === "all" ? undefined : { from: data.from, to: data.to }}
          showUnlinked
        />
      )}
    </main>
  );
}
