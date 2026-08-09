import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { Notice } from "../../features/dashboard/types.js";

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
          ? "border-[#c9e2d7] bg-[#eef7f3] text-[#245b47]"
          : "border-[#ecc9cd] bg-wago-danger-soft text-[#813039]"
      }`}
      role={success ? "status" : "alert"}
    >
      {success ? <CheckCircle2 className="mt-0.5 shrink-0" size={15} /> : <AlertCircle className="mt-0.5 shrink-0" size={15} />}
      <span className="leading-5">{notice.message}</span>
    </div>
  );
}
