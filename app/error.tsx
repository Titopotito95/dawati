"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="paper grid min-h-svh place-items-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-burgundy">حدث خطأ غير متوقع</h1>
        <p className="mt-3 text-ink-soft">نعتذر عن ذلك. يرجى المحاولة مرة أخرى.</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-6">إعادة المحاولة</button>
      </div>
    </main>
  );
}
