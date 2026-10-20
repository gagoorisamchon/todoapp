import Link from "next/link";
import type { ReactNode } from "react";

type Props = { id: string; title: string; href?: string; linkLabel?: string; testId: string; children: ReactNode };

// Shared frame of the four dashboard cards (PLAN 단계 7).
export function DashboardCard({ id, title, href, linkLabel, testId, children }: Props) {
  return (
    <section aria-labelledby={id} data-testid={testId} className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {href && (
          <Link href={href} className="text-xs text-muted-foreground hover:underline">
            {linkLabel} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
