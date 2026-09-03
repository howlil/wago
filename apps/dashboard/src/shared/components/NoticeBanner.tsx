import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { Notice } from "../ui/feedback.js";

type NoticeBannerProps = {
  notice: Notice;
};

export function NoticeBanner({ notice }: NoticeBannerProps) {
  if (!notice) {
    return null;
  }

  const success = notice.type === "success";

  return (
    <div
      className={`mt-3 flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] ${
        success
          ? "border-wago-positive/25 bg-wago-brand-soft text-wago-brand-strong"
          : "border-wago-danger/30 bg-wago-danger-soft text-wago-danger"
      }`}
      role={success ? "status" : "alert"}
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 shrink-0" size={15} />
      ) : (
        <AlertCircle className="mt-0.5 shrink-0" size={15} />
      )}
      <span className="leading-5">{notice.message}</span>
    </div>
  );
}
