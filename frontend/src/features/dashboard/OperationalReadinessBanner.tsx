import { AlertTriangle, CircleX } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchGatewayReadiness,
  type GatewayReadinessSnapshot,
  getOperationalReadinessWarning,
} from "./readiness-state.js";

const READINESS_REFRESH_MS = 15_000;

export function OperationalReadinessBanner() {
  const [readiness, setReadiness] = useState<GatewayReadinessSnapshot | null>(null);

  useEffect(() => {
    let disposed = false;

    async function refresh() {
      try {
        const snapshot = await fetchGatewayReadiness();
        if (!disposed) setReadiness(snapshot);
      } catch {
        if (!disposed) setReadiness(null);
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), READINESS_REFRESH_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

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
