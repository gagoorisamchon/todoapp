"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createTodo, updateTodo } from "@/app/actions/todos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isWithin } from "@/lib/date";
import type { TodoDTO, WeeklyPlanDTO } from "@/lib/dto";
import type { FieldErrors } from "@/lib/errors";
import type { WeeklyPlanWithProgress } from "@/lib/queries";

type Props = {
  todo: TodoDTO | null; // null = create
  plans: WeeklyPlanWithProgress[];
  defaultPlan?: WeeklyPlanDTO; // create only: prefill the plan and its start date
  defaultDate?: string; // create only: prefill the date (e.g. the /board day view's date)
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FALLBACK_ERROR = "저장하지 못했습니다. 다시 시도하세요.";

export function FieldError({ id, messages }: { id: string; messages: string[] | undefined }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {messages[0]}
    </p>
  );
}

// Form-level error that no single field owns.
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function TodoForm({ todo, plans, defaultPlan, defaultDate, open, onOpenChange }: Props) {
  const [title, setTitle] = useState(todo?.title ?? "");
  const [date, setDate] = useState(todo?.date ?? defaultPlan?.startDate ?? defaultDate ?? "");
  const [planId, setPlanId] = useState(todo ? (todo.weeklyPlanId ?? "") : (defaultPlan?.id ?? ""));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Only plans whose range contains the chosen date can be linked (PRD L45).
  const choices = date ? plans.filter((p) => isWithin(date, p.startDate, p.endDate)) : [];

  function changeDate(next: string) {
    setDate(next);
    const plan = plans.find((p) => p.id === planId);
    if (plan && !(next && isWithin(next, plan.startDate, plan.endDate))) setPlanId("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Empty values go to zod as null so its messages (제목을/날짜를 입력하세요) are shown (AC1).
    const values = { title, date: date || null, weeklyPlanId: planId || null };
    startTransition(async () => {
      try {
        const result = todo ? await updateTodo({ id: todo.id, ...values }) : await createTodo(values);
        if (result.ok) {
          onOpenChange(false);
          return;
        }
        const fieldErrors = result.fieldErrors ?? {};
        setErrors(fieldErrors);
        const known = ["title", "date", "weeklyPlanId"].some((k) => fieldErrors[k]?.length);
        setFormError(known ? null : (fieldErrors._form?.[0] ?? FALLBACK_ERROR));
      } catch {
        setErrors({});
        setFormError(FALLBACK_ERROR);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{todo ? "할 일 수정" : "할 일 추가"}</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4" aria-label={todo ? "할 일 수정" : "할 일 추가"}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="todo-title">제목</Label>
            <Input
              id="todo-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "todo-title-error" : undefined}
              autoFocus
            />
            <FieldError id="todo-title-error" messages={errors.title} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="todo-date">날짜</Label>
            <Input
              id="todo-date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => changeDate(e.target.value)}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? "todo-date-error" : undefined}
            />
            <FieldError id="todo-date-error" messages={errors.date} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="todo-plan">주간 계획</Label>
            <select
              id="todo-plan"
              name="weeklyPlanId"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              aria-invalid={errors.weeklyPlanId ? true : undefined}
              aria-describedby={errors.weeklyPlanId ? "todo-plan-error" : undefined}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            >
              <option value="">연결 안 함</option>
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.startDate} ~ {p.endDate})
                </option>
              ))}
            </select>
            {date && choices.length === 0 && (
              <p className="text-xs text-muted-foreground">이 날짜를 포함하는 주간 계획이 없습니다.</p>
            )}
            <FieldError id="todo-plan-error" messages={errors.weeklyPlanId} />
          </div>
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
