import { AlertTriangle, CircleX } from "lucide-react";
import type { GatewayReadinessSnapshot } from "../gateway/api.js";
import { getOperationalReadinessWarning } from "./readiness-state.js";

type OperationalReadinessBannerProps = {
  readiness: GatewayReadinessSnapshot | null;
};

export function OperationalReadinessBanner({ readiness }: OperationalReadinessBannerProps) {
  const warning = getOperationalReadinessWarning(readiness);
  if (!warning) return null;

  const danger = warning.tone === "danger";
  return (
    <div
      className={`mt-3 flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] ${
        danger ? "border-[#ecc9cd] bg-wago-danger-soft text-[#813039]" : "border-[#ead9ad] bg-[#fff9e9] text-[#735b1f]"
      }`}
      role="alert"
    >
      {danger ? (
        <CircleX className="mt-0.5 shrink-0" size={15} />
      ) : (
        <AlertTriangle className="mt-0.5 shrink-0" size={15} />
      )}
      <span className="leading-5">{warning.message}</span>
    </div>
  );
}
