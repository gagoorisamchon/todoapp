"use client";

import {
  DndContext,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { PlusIcon } from "lucide-react";
import { useId, useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTodo, updateTodoStatus } from "@/app/actions/todos";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TodoForm } from "@/components/forms/TodoForm";
import { Button } from "@/components/ui/button";
import type { TodoDTO, WeeklyPlanDTO } from "@/lib/dto";
import type { TodoStatus } from "@/lib/models/Todo";
import type { WeeklyPlanWithProgress } from "@/lib/queries";
import { Column, STATUS_LABELS, STATUSES } from "./Column";
import { TodoCard } from "./TodoCard";

// R9: date asc, then createdAt asc.
const byDateThenCreated = (a: TodoDTO, b: TodoDTO) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

const isStatus = (id: UniqueIdentifier | undefined): id is TodoStatus =>
  STATUSES.includes(id as TodoStatus);

// ←/→ jump to the centre of the neighbouring column; the default getter moves by pixels (PLAN 단계 4).
const columnCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === KeyboardCode.Right ? 1 : event.code === KeyboardCode.Left ? -1 : 0;
  if (step === 0) return undefined;
  event.preventDefault();

  const overId = context.over?.id;
  const from = isStatus(overId) ? overId : (context.active?.data.current?.status as TodoStatus | undefined);
  if (!from) return undefined;
  const target = STATUSES[STATUSES.indexOf(from) + step];
  if (!target || !context.droppableContainers.get(target)) return currentCoordinates;
  const rect = context.droppableRects.get(target);
  const card = context.collisionRect;
  if (!rect || !card) return currentCoordinates;

  return {
    x: rect.left + rect.width / 2 - card.width / 2,
    y: Math.min(Math.max(currentCoordinates.y, rect.top), rect.top + rect.height - card.height),
  };
};

const titleOf = (data: Record<string, unknown> | undefined) => String(data?.title ?? "카드");
const columnName = (id: UniqueIdentifier | undefined) => (isStatus(id) ? STATUS_LABELS[id] : undefined);

const announcements: Announcements = {
  onDragStart: ({ active }) => `${titleOf(active.data.current)} 카드를 들었습니다.`,
  onDragOver: ({ active, over }) =>
    columnName(over?.id)
      ? `${titleOf(active.data.current)} 카드가 ${columnName(over?.id)} 컬럼 위에 있습니다.`
      : `${titleOf(active.data.current)} 카드가 컬럼 밖에 있습니다.`,
  onDragEnd: ({ active, over }) =>
    columnName(over?.id)
      ? `${titleOf(active.data.current)} 카드를 ${columnName(over?.id)} 컬럼에 놓았습니다.`
      : `${titleOf(active.data.current)} 카드를 놓았습니다. 상태는 바뀌지 않았습니다.`,
  onDragCancel: ({ active }) => `${titleOf(active.data.current)} 카드 이동을 취소했습니다.`,
};

const screenReaderInstructions = {
  draggable:
    "카드를 들려면 스페이스 또는 엔터를 누르세요. 왼쪽·오른쪽 방향키로 컬럼을 옮기고, 스페이스 또는 엔터로 놓습니다. 취소하려면 Esc를 누르세요.",
};

type Move = { id: string; status: TodoStatus };
type FormTarget = { key: number; todo: TodoDTO | null };

type Props = {
  todos: TodoDTO[];
  plans: WeeklyPlanWithProgress[];
  title?: string;
  defaultPlan?: WeeklyPlanDTO; // new todos start linked to this plan (/weekly/[id])
  defaultDate?: string; // new todos start on this date (/board day view)
  showUnlinked?: boolean; // list todos without a plan in a separate "주간 계획 없음" section (/board)
};

export function Board({ todos, plans, title = "칸반 보드", defaultPlan, defaultDate, showUnlinked = false }: Props) {
  const dndId = useId();
  const [, startTransition] = useTransition();
  const [optimisticTodos, applyMove] = useOptimistic(todos, (state: TodoDTO[], move: Move) =>
    state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t)),
  );
  const [form, setForm] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<TodoDTO | null>(null);
  const [deletePending, startDelete] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);

  const columns = useMemo(() => {
    const sorted = [...optimisticTodos].sort(byDateThenCreated);
    return STATUSES.map((status) => ({ status, items: sorted.filter((t) => t.status === status) }));
  }, [optimisticTodos]);

  const unlinked = useMemo(
    () => optimisticTodos.filter((t) => t.weeklyPlanId === null).sort(byDateThenCreated),
    [optimisticTodos],
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    const status = over?.id;
    const todo = optimisticTodos.find((t) => t.id === active.id);
    if (!todo || !isStatus(status) || status === todo.status) return;

    startTransition(async () => {
      applyMove({ id: todo.id, status });
      try {
        const result = await updateTodoStatus({ id: todo.id, status });
        if (!result.ok) toast.error("상태를 저장하지 못했습니다");
      } catch {
        // The optimistic move reverts when the transition ends with unchanged props.
        toast.error("상태를 저장하지 못했습니다");
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const { id } = deleting;
    startDelete(async () => {
      try {
        const result = await deleteTodo(id);
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
        <h1 className="text-xl font-semibold">{title}</h1>
        <Button onClick={() => setForm({ key: Date.now(), todo: null })}>
          <PlusIcon />할 일 추가
        </Button>
      </div>

      {showUnlinked && (
        <section
          aria-labelledby="unlinked-heading"
          data-testid="unlinked-section"
          className="flex flex-col gap-2 rounded-xl border border-dashed p-3"
        >
          <h2 id="unlinked-heading" className="flex items-center gap-2 text-sm font-semibold">
            주간 계획 없음
            <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground">{unlinked.length}</span>
          </h2>
          {unlinked.length === 0 ? (
            <p className="text-xs text-muted-foreground">이 기간에는 주간 계획에 연결되지 않은 할 일이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {unlinked.map((todo) => (
                <li key={todo.id} data-testid="unlinked-todo" className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">
                    {todo.title}{" "}
                    <span className="text-xs text-muted-foreground">
                      {todo.date} · {STATUS_LABELS[todo.status]}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`${todo.title} 계획 연결`}
                    onClick={() => setForm({ key: Date.now(), todo })}
                  >
                    계획 연결
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <DndContext
        id={dndId}
        sensors={sensors}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements, screenReaderInstructions }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {columns.map(({ status, items }) => (
            <Column key={status} status={status} count={items.length}>
              {items.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  plan={todo.weeklyPlanId ? planById.get(todo.weeklyPlanId) : undefined}
                  onEdit={(t) => setForm({ key: Date.now(), todo: t })}
                  onDelete={setDeleting}
                />
              ))}
            </Column>
          ))}
        </div>
      </DndContext>

      {form && (
        <TodoForm
          key={form.key}
          todo={form.todo}
          plans={plans}
          defaultPlan={defaultPlan}
          defaultDate={defaultDate}
          open
          onOpenChange={(open) => !open && setForm(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !deletePending && setDeleting(null)}
        title="할 일을 삭제할까요?"
        description={deleting ? `"${deleting.title}"을(를) 삭제합니다. 되돌릴 수 없습니다.` : undefined}
        confirmLabel="삭제"
        pending={deletePending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
