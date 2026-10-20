"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteWeeklyPlan } from "@/app/actions/weekly-plans";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WeeklyPlanForm } from "@/components/forms/WeeklyPlanForm";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import type { GoalDTO, WeeklyPlanDTO } from "@/lib/dto";
import type { WeeklyPlanWithProgress } from "@/lib/queries";

type FormTarget = { key: number; plan: WeeklyPlanDTO | null };

export function WeeklyPlanList({ plans, goals }: { plans: WeeklyPlanWithProgress[]; goals: GoalDTO[] }) {
  const [form, setForm] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<WeeklyPlanDTO | null>(null);
  const [deletePending, startDelete] = useTransition();
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  function confirmDelete() {
    if (!deleting) return;
    const { id } = deleting;
    startDelete(async () => {
      try {
        const result = await deleteWeeklyPlan(id);
        if (!result.ok) {
          toast.error("삭제하지 못했습니다");
          return;
        }
        setDeleting(null);
      } catch {
        toast.error("삭제하지 못했습니다");
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">주간 계획</h1>
        <Button onClick={() => setForm({ key: Date.now(), plan: null })}>
          <PlusIcon />
          주간 계획 추가
        </Button>
      </div>

      {plans.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          아직 주간 계획이 없습니다. &quot;주간 계획 추가&quot;로 첫 계획을 만들어 보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="주간 계획 목록">
          {plans.map((plan) => {
            const goal = plan.goalId ? goalById.get(plan.goalId) : undefined;
            return (
              <li key={plan.id} data-testid="weekly-plan-row" className="flex flex-col gap-2 rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link href={`/weekly/${plan.id}`} className="font-medium break-words hover:underline">
                      {plan.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {plan.startDate} ~ {plan.endDate}
                    </p>
                    <p className="text-xs">
                      {goal ? (
                        <Link href={`/goals/${goal.id}`} className="hover:underline">
                          목표: {goal.title} ({goal.year})
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">목표 없음</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${plan.title} 수정`}
                      onClick={() => setForm({ key: Date.now(), plan })}
                    >
                      <PencilIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`${plan.title} 삭제`} onClick={() => setDeleting(plan)}>
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
                <ProgressBar
                  percent={plan.percent}
                  label={`${plan.title} 진행률`}
                  data-testid={`plan-progress-${plan.id}`}
                />
                <p className="text-xs text-muted-foreground">
                  완료 {plan.done} / 전체 {plan.total}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <WeeklyPlanForm
          key={form.key}
          plan={form.plan}
          goals={goals}
          open
          onOpenChange={(open) => !open && setForm(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !deletePending && setDeleting(null)}
        title="주간 계획을 삭제할까요?"
        description={
          deleting ? `"${deleting.title}"을(를) 삭제합니다. 연결된 할 일은 지워지지 않고 연결만 해제됩니다.` : undefined
        }
        confirmLabel="삭제"
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
