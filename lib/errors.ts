import type { z } from "zod";
import type { TodoDTO, WeeklyPlanDTO } from "./dto";

// Error codes returned to the UI (PLAN §2.1). Parent-missing links use "invalid_link".
export type DomainErrorCode =
  | "invalid_input"
  | "not_found"
  | "invalid_link"
  | "out_of_range"
  | "year_mismatch"
  | "range_conflict"
  | "year_conflict"
  | "conflict";

export type FieldErrors = Record<string, string[]>;
export type Conflict = TodoDTO | WeeklyPlanDTO;

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: DomainErrorCode; fieldErrors?: FieldErrors; conflicts?: Conflict[] };

// Thrown inside a transaction callback to abort it; never `return` a failure from the callback (PLAN §2.1).
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly conflicts?: Conflict[];
  readonly fieldErrors?: FieldErrors;

  constructor(code: DomainErrorCode, opts: { conflicts?: Conflict[]; fieldErrors?: FieldErrors } = {}) {
    super(code);
    this.name = "DomainError";
    this.code = code;
    this.conflicts = opts.conflicts;
    this.fieldErrors = opts.fieldErrors;
  }

  toResult(): Result<never> {
    return {
      ok: false,
      error: this.code,
      ...(this.fieldErrors && { fieldErrors: this.fieldErrors }),
      ...(this.conflicts && { conflicts: this.conflicts }),
    };
  }
}

// zod failure -> Result for Server Actions.
export function invalidInput(error: z.ZodError): Result<never> {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: "invalid_input", fieldErrors };
}
