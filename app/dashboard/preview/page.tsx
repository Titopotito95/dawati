import { requireCustomer } from "@/lib/auth";
import { previewViewModel } from "@/lib/services/workspace";
import PreviewClient from "./PreviewClient";

export default async function PreviewPage() {
  const { ws } = await requireCustomer();
  return <PreviewClient vm={previewViewModel(ws)} />;
}
