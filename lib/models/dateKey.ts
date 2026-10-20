// Shared `YYYY-MM-DD` string field definition (PLAN §2).
export const dateKey = {
  type: String,
  required: true,
  match: /^\d{4}-\d{2}-\d{2}$/,
} as const;
