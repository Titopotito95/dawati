import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireAffiliate } from "@/lib/auth";
import { affiliateSummary } from "@/lib/services/affiliates";
import { publicBaseUrl } from "@/lib/security/request";
import CopyButton from "@/components/ui/CopyButton";
import WhatsAppShare from "@/components/ui/WhatsAppShare";

export default async function LinkPage() {
  const { db, affiliate } = await requireAffiliate();
  const url = `${publicBaseUrl(await headers())}/?ref=${affiliate.referralCode}`;
  const [svg, s] = await Promise.all([QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#5b1a2a", light: "#ffffff" } }), affiliateSummary(db, affiliate.id)]);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card space-y-4 p-5">
        <div>
          <p className="text-sm text-ink-soft">رمز الإحالة</p>
          <p className="mono text-2xl font-bold text-burgundy">{affiliate.referralCode}</p>
        </div>
        <div>
          <p className="text-sm text-ink-soft">رابط الإحالة</p>
          <p className="mono mt-1 break-all rounded-xl bg-pearl px-3 py-2 text-sm" dir="ltr">{url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={url} label="نسخ الرابط" />
          <WhatsAppShare text="شاهد دعوات الزفاف الرقمية الفاخرة واطلب دعوتك:" url={url} label="مشاركة عبر واتساب" />
        </div>
        <p className="text-sm leading-7 text-ink-soft">
          من يفتح رابطك ثم يضغط «اطلب» يتواصل معك مباشرة عبر واتساب{affiliate.phone ? "" : " (أضف رقم هاتفك لدى الإدارة لتفعيل ذلك)"}. الدفع يتم يداً بيد، وتُحتسب عمولتك عند تسجيل البيع باسمك.
        </p>
        <p className="text-xs text-ink-soft">زيارات الرابط: {s.visits} — زوار مختلفون: {s.visitors}. (قد لا تُحتسب بعض الزيارات بسبب إعدادات المتصفح أو مانعات التتبع.)</p>
      </div>
      <div className="card flex flex-col items-center p-5">
        <p className="mb-3 font-semibold">رمز QR للرابط</p>
        <div className="w-64 max-w-full" dangerouslySetInnerHTML={{ __html: svg }} aria-label="رمز QR لرابط الإحالة" role="img" />
        <p className="hint mt-3 text-center">اطبعه أو اعرضه على هاتفك ليمسحه العملاء.</p>
      </div>
    </div>
  );
}
