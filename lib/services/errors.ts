/** An error whose message is safe to show to the user (always Arabic). */
export class UserError extends Error {
  constructor(
    message: string,
    public code: "bad_request" | "forbidden" | "not_found" | "conflict" | "rate_limited" | "unauthorized" = "bad_request",
  ) {
    super(message);
    this.name = "UserError";
  }
}

export const GENERIC_ERROR = "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى";

export function userMessage(e: unknown): string {
  if (e instanceof UserError) return e.message;
  console.error(e);
  return GENERIC_ERROR;
}
