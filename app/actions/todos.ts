"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import type { TodoDTO } from "@/lib/dto";
import { invalidInput, type Result } from "@/lib/errors";
import * as todoService from "@/lib/services/todos";
import { objectIdString, todoCreateInput, todoStatusInput, todoUpdateInput } from "@/lib/validation";

// Thin wrappers: zod -> service -> revalidatePath after the service returns (PLAN 단계 3).
export async function createTodo(input: unknown): Promise<Result<TodoDTO>> {
  const parsed = todoCreateInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const result = await todoService.createTodo(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateTodo(input: unknown): Promise<Result<TodoDTO>> {
  const parsed = todoUpdateInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const { id, ...patch } = parsed.data;
  const result = await todoService.updateTodo(id, patch);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateTodoStatus(input: unknown): Promise<Result<TodoDTO>> {
  const parsed = todoStatusInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const result = await todoService.updateTodoStatus(parsed.data.id, parsed.data.status);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteTodo(id: unknown): Promise<Result<{ id: string }>> {
  const parsed = objectIdString.safeParse(id);
  if (!parsed.success) return invalidInput(parsed.error);
  await connectDB();
  const result = await todoService.deleteTodo(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
