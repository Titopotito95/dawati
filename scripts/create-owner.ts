/**
 * Creates the owner account from the server terminal (no public signup exists).
 *   npm run owner:create
 * With the embedded database (no DATABASE_URL), stop `npm run dev` first: PGlite is single-process.
 */
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { beginOwnerSetup, completeOwnerSetup, ownerExists } from "@/lib/services/owner";

async function main() {
  const db = await getDb();
  if (await ownerExists(db)) {
    console.log("يوجد حساب مالك مفعّل مسبقاً. (An owner account already exists.)");
    process.exit(0);
  }
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const username = (await rl.question("اسم المستخدم / username: ")).trim();
  const password = await rl.question("كلمة المرور (12+ حرفاً) / password: ");
  const { ownerId, secret, otpauth } = await beginOwnerSetup(db, username, password);
  console.log("\nامسح رمز QR التالي بتطبيق المصادقة (Google/Microsoft Authenticator):\n");
  console.log(await QRCode.toString(otpauth, { type: "terminal", small: true }));
  console.log(`أو أدخل المفتاح يدوياً: ${secret}\n`);
  const code = (await rl.question("أدخل الرمز المكون من 6 أرقام: ")).trim();
  await completeOwnerSetup(db, ownerId, code);
  rl.close();
  console.log("\n✓ تم إنشاء حساب المالك وتفعيل التحقق بخطوتين. ادخل من /owner");
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
