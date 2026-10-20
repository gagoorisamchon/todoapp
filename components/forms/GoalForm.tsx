"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createGoal, updateGoal } from "@/app/actions/goals";
import { ConflictList } from "@/components/ConflictList";
import { FieldError, FormError } from "@/components/forms/TodoForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GoalDTO } from "@/lib/dto";
import type { Conflict, FieldErrors } from "@/lib/errors";

type Props = {
  goal: GoalDTO | null; // null = create
  defaultYear: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FALLBACK_ERROR = "저장하지 못했습니다. 다시 시도하세요.";

export function GoalForm({ goal, defaultYear, open, onOpenChange }: Props) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [year, setYear] = useState(String(goal?.year ?? defaultYear));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [pending, startTransition] = useTransition();
  const label = goal ? "목표 수정" : "목표 추가";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { title, year: year.trim() === "" ? null : Number(year) };
    startTransition(async () => {
      try {
        const result = goal ? await updateGoal({ id: goal.id, ...values }) : await createGoal(values);
        if (result.ok) {
          onOpenChange(false);
          return;
        }
        const fieldErrors = result.fieldErrors ?? {};
        setErrors(fieldErrors);
        // R8: linked plans would fall outside the new year.
        setConflicts(result.error === "year_conflict" ? (result.conflicts ?? []) : []);
        const known = ["title", "year"].some((k) => fieldErrors[k]?.length) || result.error === "year_conflict";
        if (known) setFormError(null);
        else if (result.error === "not_found") setFormError("목표를 찾을 수 없습니다.");
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
            <Label htmlFor="goal-title">제목</Label>
            <Input
              id="goal-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "goal-title-error" : undefined}
              autoFocus
            />
            <FieldError id="goal-title-error" messages={errors.title} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-year">연도</Label>
            <Input
              id="goal-year"
              name="year"
              type="number"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              aria-invalid={errors.year ? true : undefined}
              aria-describedby={errors.year ? "goal-year-error" : undefined}
            />
            <FieldError id="goal-year-error" messages={errors.year} />
          </div>
          <ConflictList conflicts={conflicts} title="다른 연도에 시작하는 주간 계획이 연결되어 있어 저장할 수 없습니다" />
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
