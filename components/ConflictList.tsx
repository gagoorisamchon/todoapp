import type { Conflict } from "@/lib/errors";

// Lists the documents that block a save (R4: todos outside the new range, R8: plans in another year).
export function ConflictList({ conflicts, title = "충돌하는 항목" }: { conflicts: Conflict[]; title?: string }) {
  if (conflicts.length === 0) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">{title}</p>
      <ul className="mt-1 list-disc pl-5" data-testid="conflict-list">
        {conflicts.map((c) => (
          <li key={c.id}>
            {c.title} <span className="text-muted-foreground">({"date" in c ? c.date : `${c.startDate} ~ ${c.endDate}`})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
