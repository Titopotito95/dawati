import type { ReactNode } from "react";

/** Phone-shaped frame used for previews on larger screens (full-screen on real phones). */
export default function PhoneFrame({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={`phone-frame ${className}`} aria-label={label}>
      <div className="phone-frame__screen">{children}</div>
      <div className="phone-frame__island" aria-hidden="true" />
    </div>
  );
}
