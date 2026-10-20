"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGoal } from "@/app/actions/goals";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GoalForm } from "@/components/forms/GoalForm";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import type { GoalDTO } from "@/lib/dto";

export type GoalRow = GoalDTO & { planCount: number; percent: number };
type FormTarget = { key: number; goal: GoalDTO | null };

export function GoalList({ goals, defaultYear }: { goals: GoalRow[]; defaultYear: number }) {
  const [form, setForm] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<GoalDTO | null>(null);
  const [deletePending, startDelete] = useTransition();

  function confirmDelete() {
    if (!deleting) return;
    const { id } = deleting;
    startDelete(async () => {
      try {
        const result = await deleteGoal(id);
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
        <h1 className="text-xl font-semibold">1년 목표</h1>
        <Button onClick={() => setForm({ key: Date.now(), goal: null })}>
          <PlusIcon />
          목표 추가
        </Button>
      </div>

      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          아직 목표가 없습니다. &quot;목표 추가&quot;로 올해 목표를 만들어 보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="목표 목록">
          {goals.map((goal) => (
            <li key={goal.id} data-testid="goal-row" className="flex flex-col gap-2 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-xs text-muted-foreground">{goal.year}년</p>
                  <Link href={`/goals/${goal.id}`} className="font-medium break-words hover:underline">
                    {goal.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">연결된 주간 계획 {goal.planCount}개</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${goal.title} 수정`}
                    onClick={() => setForm({ key: Date.now(), goal })}
                  >
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`${goal.title} 삭제`} onClick={() => setDeleting(goal)}>
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
              <ProgressBar percent={goal.percent} label={`${goal.title} 목표 진행률`} data-testid={`goal-progress-${goal.id}`} />
            </li>
          ))}
        </ul>
      )}

      {form && (
        <GoalForm
          key={form.key}
          goal={form.goal}
          defaultYear={defaultYear}
          open
          onOpenChange={(open) => !open && setForm(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !deletePending && setDeleting(null)}
        title="목표를 삭제할까요?"
        description={
          deleting ? `"${deleting.title}"을(를) 삭제합니다. 연결된 주간 계획은 지워지지 않고 연결만 해제됩니다.` : undefined
        }
        confirmLabel="삭제"
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
