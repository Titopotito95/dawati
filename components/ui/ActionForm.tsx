"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type ActionResult = { ok: boolean; message?: string; data?: Record<string, unknown> };

export function SubmitButton({ children, pending, className = "btn btn-primary", disabled }: { children: ReactNode; pending?: ReactNode; className?: string; disabled?: boolean }) {
  const s = useFormStatus();
  return (
    <button type="submit" className={className} disabled={s.pending || disabled} aria-busy={s.pending}>
      {s.pending ? pending ?? "جارٍ الحفظ…" : children}
    </button>
  );
}

/**
 * Wraps a server action. Shows Arabic success/error messages; optional render prop receives the
 * returned data (e.g. a one-time secret to display).
 */
export default function ActionForm({
  action,
  children,
  className = "",
  confirm,
  resetOnSuccess = false,
  render,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  render?: (r: ActionResult) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div aria-live="polite">
        {state?.message ? (
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${state.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`} role={state.ok ? "status" : "alert"}>
            {state.message}
          </p>
        ) : null}
        {state && render ? render(state) : null}
      </div>
    </form>
  );
}
