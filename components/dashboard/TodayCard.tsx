import Link from "next/link";
import type { DashboardSummary } from "@/lib/queries";
import { DashboardCard } from "./Card";

// Kept here: the kanban labels live in a client module (PLAN 단계 7 오늘 카드).
const STATUS = [
  { key: "todo", label: "할 일" },
  { key: "doing", label: "진행 중" },
  { key: "done", label: "완료" },
] as const;

export function TodayCard({ today, data }: { today: string; data: DashboardSummary["todayCard"] }) {
  const total = data.counts.todo + data.counts.doing + data.counts.done;
  return (
    <DashboardCard id="dash-today" title={`오늘 (${today})`} href="/board?view=day" linkLabel="보드에서 보기" testId="dashboard-today">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {STATUS.map(({ key, label }) => (
          <div key={key} className="rounded-lg bg-muted p-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums" data-testid={`today-count-${key}`}>
              {data.counts[key]}
            </dd>
          </div>
        ))}
      </dl>
      {data.todos.length === 0 ? (
        <p className="text-sm text-muted-foreground">오늘 할 일이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {data.todos.map((todo) => (
            <li key={todo.id} data-testid="today-todo" className="flex items-baseline justify-between gap-2">
              <Link href="/board?view=day" className="min-w-0 break-words hover:underline">
                {todo.title}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">
                {STATUS.find((s) => s.key === todo.status)?.label}
              </span>
            </li>
          ))}
          {total > data.todos.length && (
            <li className="text-xs text-muted-foreground">외 {total - data.todos.length}개</li>
          )}
        </ul>
      )}
    </DashboardCard>
  );
}
