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
      className={`mb-5 mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        success
          ? "border-[#bfe1d4] bg-[#e7f6f0] text-[#155a45]"
          : "border-[#efc1c5] bg-[#fff0f1] text-[#8b2932]"
      }`}
      role={success ? "status" : "alert"}
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
      ) : (
        <AlertCircle className="mt-0.5 shrink-0" size={17} />
      )}
      <span className="font-medium leading-6">{notice.message}</span>
    </div>
  );
}
