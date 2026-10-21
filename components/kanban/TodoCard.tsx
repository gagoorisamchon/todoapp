"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { TodoDTO } from "@/lib/dto";
import type { WeeklyPlanWithProgress } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Props = {
  todo: TodoDTO;
  plan: WeeklyPlanWithProgress | undefined;
  onEdit: (todo: TodoDTO) => void;
  onDelete: (todo: TodoDTO) => void;
  highlighted?: boolean; // briefly marks a just-created card
};

export function TodoCard({ todo, plan, onEdit, onDelete, highlighted = false }: Props) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: todo.id,
    data: { status: todo.status, title: todo.title },
    attributes: { roleDescription: "드래그 가능한 카드" },
  });

  useEffect(() => {
    if (highlighted) nodeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlighted]);

  return (
    <li>
      <div
        ref={(el) => {
          nodeRef.current = el;
          setNodeRef(el);
          // Only the card itself starts a keyboard drag, not its buttons.
          setActivatorNodeRef(el);
        }}
        data-testid="todo-card"
        data-highlighted={highlighted ? "true" : undefined}
        style={{ transform: CSS.Translate.toString(transform) }}
        className={cn(
          "relative flex flex-col gap-1 rounded-lg border bg-background p-3 shadow-xs outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50",
          highlighted && "ring-2 ring-primary",
          isDragging && "z-10 cursor-grabbing shadow-lg",
        )}
        {...attributes}
        {...listeners}
      >
        <p className="pr-14 font-medium break-words">{todo.title}</p>
        <p className="text-xs text-muted-foreground">{todo.date}</p>
        {plan && (
          <p className="flex items-center gap-1.5 text-xs" data-testid="todo-card-plan">
            <span className="truncate">{plan.title}</span>
            <span className="rounded-full bg-secondary px-1.5 font-medium text-secondary-foreground">{plan.percent}%</span>
          </p>
        )}
        <div className="absolute top-2 right-2 flex gap-0.5">
          <Button variant="ghost" size="icon-xs" aria-label={`${todo.title} 수정`} onClick={() => onEdit(todo)}>
            <PencilIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label={`${todo.title} 삭제`} onClick={() => onDelete(todo)}>
            <Trash2Icon />
          </Button>
        </div>
      </div>
    </li>
  );
}
