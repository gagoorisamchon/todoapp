import { cn } from "@/lib/utils";

type Props = { percent: number; label?: string; className?: string; "data-testid"?: string };

// Percent is an integer computed on read (PLAN §1 R6); this only renders it.
export function ProgressBar({ percent, label = "진행률", className, "data-testid": testId }: Props) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div className={cn("flex items-center gap-2", className)} data-testid={testId}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${value}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{value}%</span>
    </div>
  );
}
