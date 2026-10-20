"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { TodoStatus } from "@/lib/models/Todo";
import { cn } from "@/lib/utils";

// Kept here (not imported from the model) so mongoose stays out of the client bundle.
export const STATUSES: readonly TodoStatus[] = ["todo", "doing", "done"];
export const STATUS_LABELS: Record<TodoStatus, string> = { todo: "할 일", doing: "진행 중", done: "완료" };

export function Column({ status, count, children }: { status: TodoStatus; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${status}`}
      aria-label={STATUS_LABELS[status]}
      className={cn(
        "flex min-h-64 flex-col gap-2 rounded-xl border bg-muted/40 p-3 transition-colors",
        isOver && "border-primary bg-muted",
      )}
    >
      <h2 className="flex items-center justify-between text-sm font-semibold">
        {STATUS_LABELS[status]}
        <span className="rounded-full bg-background px-2 text-xs font-normal text-muted-foreground">{count}</span>
      </h2>
      {count === 0 && <p className="text-xs text-muted-foreground">할 일이 없습니다.</p>}
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}
