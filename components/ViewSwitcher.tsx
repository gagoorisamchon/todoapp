"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import type { BoardView } from "@/lib/queries";
import { cn } from "@/lib/utils";

// Kept here (not imported from lib/validation) so mongoose stays out of the client bundle.
const VIEWS: { view: BoardView; label: string }[] = [
  { view: "all", label: "전체" },
  { view: "day", label: "일간" },
  { view: "week", label: "주간" },
  { view: "year", label: "연간" },
];
const STEP_LABELS: Record<Exclude<BoardView, "all">, [string, string]> = {
  day: ["이전 날", "다음 날"],
  week: ["이전 주", "다음 주"],
  year: ["이전 해", "다음 해"],
};

// The all view has no date range, so it is plain /board (the default view, same URL as the nav link).
export const boardHref = (view: BoardView, date: string) => (view === "all" ? "/board" : `/board?view=${view}&date=${date}`);

type Props = {
  view: BoardView;
  date: string;
  rangeLabel: string;
  prevDate: string; // day ±1, week ±7, year ±1 (computed on the server with lib/date); unused in the all view
  nextDate: string;
  today: string;
};

// All view state lives in the URL, so reload and back/forward keep it (PLAN 단계 6.3).
export function ViewSwitcher({ view, date, rangeLabel, prevDate, nextDate, today }: Props) {
  const router = useRouter();
  // The all view has no range to step through; picking a date or 오늘 opens that day's view.
  const isAll = view === "all";
  const dateView = isAll ? "day" : view;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border p-2" data-testid="view-switcher">
      <nav aria-label="보기 전환">
        <ul className="flex gap-1">
          {VIEWS.map((v) => (
            <li key={v.view}>
              <Link
                href={boardHref(v.view, date)}
                aria-current={v.view === view ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm hover:bg-muted",
                  v.view === view ? "bg-muted font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {v.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center gap-1">
        {!isAll && (
          <Link
            href={boardHref(view, prevDate)}
            aria-label={STEP_LABELS[view][0]}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <ChevronLeftIcon className="size-4" />
          </Link>
        )}
        <span className="min-w-36 text-center text-sm font-medium tabular-nums" data-testid="view-range">
          {rangeLabel}
        </span>
        {!isAll && (
          <Link
            href={boardHref(view, nextDate)}
            aria-label={STEP_LABELS[view][1]}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <ChevronRightIcon className="size-4" />
          </Link>
        )}
      </div>
      <Input
        type="date"
        aria-label="날짜 선택"
        className="w-auto"
        key={date}
        defaultValue={date}
        onChange={(e) => {
          if (e.target.value) router.push(boardHref(dateView, e.target.value));
        }}
      />
      {(isAll || date !== today) && (
        <Link href={boardHref(dateView, today)} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
          오늘
        </Link>
      )}
    </div>
  );
}
