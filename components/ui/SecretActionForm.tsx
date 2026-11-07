"use client";
import type { ReactNode } from "react";
import ActionForm, { type ActionResult } from "./ActionForm";
import SecretReveal from "./SecretReveal";

/** An ActionForm whose result may carry a one-time secret (data.token) plus optional extra lines (data.lines). */
export default function SecretActionForm({
  action,
  children,
  secretTitle,
  filename,
  confirm,
  className,
  resetOnSuccess,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  secretTitle: string;
  filename: string;
  confirm?: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  return (
    <ActionForm
      action={action}
      confirm={confirm}
      className={className}
      resetOnSuccess={resetOnSuccess}
      render={(r) => {
        const token = r.ok ? (r.data?.token as string | undefined) : undefined;
        if (!token) return null;
        const lines = (r.data?.lines as string[] | undefined) ?? [];
        return (
          <div>
            {lines.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : null}
            <SecretReveal secret={token} title={secretTitle} filename={filename} />
          </div>
        );
      }}
    >
      {children}
    </ActionForm>
  );
}
