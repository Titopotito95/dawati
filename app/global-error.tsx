"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", background: "#fbf7f4" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1>حدث خطأ غير متوقع</h1>
          <p>يرجى المحاولة مرة أخرى.</p>
          <button type="button" onClick={reset}>إعادة المحاولة</button>
        </div>
      </body>
    </html>
  );
}
