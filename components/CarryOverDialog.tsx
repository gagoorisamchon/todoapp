"use client";

import { ArrowRightIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { carryOver } from "@/app/actions/carry-over";
import { FieldError, FormError } from "@/components/forms/TodoForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldErrors } from "@/lib/errors";
import type { CarryOverCandidates } from "@/lib/services/carryOver";

const FALLBACK_ERROR = "이월하지 못했습니다. 다시 시도하세요.";

// R7: unfinished todos of this plan move to a next-week plan the user picks (or creates), dates +7.
export function CarryOverDialog({ data }: { data: CarryOverCandidates }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ArrowRightIcon />
        미완료 이월
      </Button>
      {open && <CarryOverForm data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

function CarryOverForm({ data, onClose }: { data: CarryOverCandidates; onClose: () => void }) {
  const { source, candidates, incompleteCount, nextStartDate } = data;
  const [planId, setPlanId] = useState(candidates[0]?.id ?? "");
  const [title, setTitle] = useState(`${source.title} (이월)`);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const creating = candidates.length === 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = creating ? { create: { title } } : { planId };
    startTransition(async () => {
      try {
        const result = await carryOver({ sourcePlanId: source.id, target });
        if (result.ok) {
          toast.success(`할 일 ${result.data.moved}개를 "${result.data.plan.title}"(으)로 이월했습니다`);
          onClose();
          return;
        }
        const fieldErrors = result.fieldErrors ?? {};
        setErrors(fieldErrors);
        const field = fieldErrors["target.create.title"] ?? fieldErrors.planId;
        setFormError(field?.length ? null : (fieldErrors._form?.[0] ?? FALLBACK_ERROR));
      } catch {
        setErrors({});
        setFormError(FALLBACK_ERROR);
      }
    });
  }

  const titleErrors = errors["target.create.title"];

  return (
    <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>미완료 이월</DialogTitle>
          <DialogDescription>
            {incompleteCount > 0
              ? `완료하지 않은 할 일 ${incompleteCount}개를 다음 주(${nextStartDate}부터)로 옮깁니다. 날짜는 7일 뒤로 바뀌고, 완료한 할 일은 이 계획에 남습니다.`
              : "이월할 미완료 할 일이 없습니다."}
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4" aria-label="미완료 이월">
          {creating ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm">다음 주에 시작하는 주간 계획이 없습니다. 새로 만들어 옮깁니다.</p>
              <Label htmlFor="carry-title">새 계획 제목</Label>
              <Input
                id="carry-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={titleErrors ? true : undefined}
                aria-describedby={titleErrors ? "carry-title-error" : undefined}
              />
              <FieldError id="carry-title-error" messages={titleErrors} />
              {data.yearBoundary ? (
                <p className="text-xs text-muted-foreground" data-testid="carry-year-boundary">
                  다음 주는 다른 해라서 새 계획은 목표 없이 만들어집니다. 나중에 다음 해 목표에 연결하세요.
                </p>
              ) : data.createGoalId ? (
                <p className="text-xs text-muted-foreground">새 계획은 이 계획과 같은 목표에 연결됩니다.</p>
              ) : null}
            </div>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">옮길 다음 주 계획</legend>
              {candidates.map((c) => (
                <label
                  key={c.id}
                  data-testid="carry-candidate"
                  className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm has-checked:border-primary"
                >
                  <input
                    type="radio"
                    name="carry-target"
                    value={c.id}
                    checked={planId === c.id}
                    onChange={() => setPlanId(c.id)}
                  />
                  <span className="min-w-0 flex-1 break-words">
                    {c.title}{" "}
                    <span className="text-xs text-muted-foreground">
                      {c.startDate} ~ {c.endDate}
                    </span>
                  </span>
                  {c.sameGoal && (
                    <span className="rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground">
                      같은 목표
                    </span>
                  )}
                </label>
              ))}
              <FieldError id="carry-plan-error" messages={errors.planId} />
            </fieldset>
          )}
          <FormError message={formError} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              취소
            </Button>
            <Button type="submit" disabled={pending || incompleteCount === 0 || (!creating && !planId)}>
              {pending ? "이월 중…" : creating ? "다음 주 계획 만들기" : "이월하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
