"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createWeeklyPlan, updateWeeklyPlan } from "@/app/actions/weekly-plans";
import { ConflictList } from "@/components/ConflictList";
import { FieldError, FormError } from "@/components/forms/TodoForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GoalDTO, WeeklyPlanDTO } from "@/lib/dto";
import type { Conflict, FieldErrors } from "@/lib/errors";

type Props = {
  plan: WeeklyPlanDTO | null; // null = create
  goals: GoalDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FALLBACK_ERROR = "저장하지 못했습니다. 다시 시도하세요.";
const FIELDS = ["title", "startDate", "goalId"];

export function WeeklyPlanForm({ plan, goals, open, onOpenChange }: Props) {
  const [title, setTitle] = useState(plan?.title ?? "");
  const [startDate, setStartDate] = useState(plan?.startDate ?? "");
  const [goalId, setGoalId] = useState(plan?.goalId ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [pending, startTransition] = useTransition();
  const label = plan ? "주간 계획 수정" : "주간 계획 추가";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Monday (R1) and goal year (R3) are enforced by the server; empty values go as null for zod messages.
    const values = { title, startDate: startDate || null, goalId: goalId || null };
    startTransition(async () => {
      try {
        const result = plan ? await updateWeeklyPlan({ id: plan.id, ...values }) : await createWeeklyPlan(values);
        if (result.ok) {
          onOpenChange(false);
          return;
        }
        const fieldErrors = result.fieldErrors ?? {};
        setErrors(fieldErrors);
        setConflicts(result.error === "range_conflict" ? (result.conflicts ?? []) : []);
        const known = FIELDS.some((k) => fieldErrors[k]?.length) || result.error === "range_conflict";
        if (known) setFormError(null);
        else if (result.error === "not_found") setFormError("주간 계획을 찾을 수 없습니다.");
        else setFormError(fieldErrors._form?.[0] ?? FALLBACK_ERROR);
      } catch {
        setErrors({});
        setConflicts([]);
        setFormError(FALLBACK_ERROR);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4" aria-label={label}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-title">제목</Label>
            <Input
              id="plan-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "plan-title-error" : undefined}
              autoFocus
            />
            <FieldError id="plan-title-error" messages={errors.title} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-start">시작일</Label>
            <Input
              id="plan-start"
              name="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-invalid={errors.startDate ? true : undefined}
              aria-describedby={errors.startDate ? "plan-start-hint plan-start-error" : "plan-start-hint"}
            />
            <p id="plan-start-hint" className="text-xs text-muted-foreground">
              월요일만 선택할 수 있습니다. 종료일은 시작일 + 6일로 자동 계산됩니다.
            </p>
            <FieldError id="plan-start-error" messages={errors.startDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-goal">목표</Label>
            <select
              id="plan-goal"
              name="goalId"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              aria-invalid={errors.goalId ? true : undefined}
              aria-describedby={errors.goalId ? "plan-goal-error" : undefined}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            >
              <option value="">목표 없음</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.year})
                </option>
              ))}
            </select>
            <FieldError id="plan-goal-error" messages={errors.goalId} />
          </div>
          <ConflictList conflicts={conflicts} title="이 기간 밖으로 벗어나는 할 일이 있어 저장할 수 없습니다" />
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
