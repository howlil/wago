import { Link2Off, Loader2, QrCode, Smartphone } from "lucide-react";
import type { WhatsAppBinding, WhatsAppStatus } from "../../api.js";
import {
  cardBodyClass,
  dangerButtonClass,
  primaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import type { HealthState } from "../dashboard/types.js";

type WhatsAppBindingCardProps = {
  health: HealthState;
  status: WhatsAppStatus;
  binding: WhatsAppBinding;
  connectionDescription: string;
  canStartPairing: boolean;
  pairingInProgress: boolean;
  pairButtonLabel: string;
  isPairing: boolean;
  isRebinding: boolean;
  onPair: () => void;
  onChangeAccount: () => void;
};

function formatBoundAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function WhatsAppBindingCard({
  health,
  status,
  binding,
  connectionDescription,
  canStartPairing,
  pairingInProgress,
  pairButtonLabel,
  isPairing,
  isRebinding,
  onPair,
  onChangeAccount,
}: WhatsAppBindingCardProps) {
  return (
    <section id="connection" className={`${cardBodyClass} scroll-mt-28`}>
      <div className="flex items-start justify-between gap-5 max-[680px]:flex-col">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f4ef] text-[#176b55]">
              <Smartphone size={19} />
            </span>
            <div>
              <h2 className={sectionTitleClass}>WhatsApp Connection</h2>
              <p className={sectionDescriptionClass}>{connectionDescription}</p>
            </div>
          </div>

          {binding.state === "bound" ? (
            <div className="mt-5 grid gap-2 rounded-xl border border-[#d9e8e2] bg-[#f1f8f5] p-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#718179]">
                  Bound account
                </span>
                <strong className="mt-1 block font-mono text-sm text-[#176b55]">{binding.phone}</strong>
              </div>
              <span className="text-xs text-[#718179]">{formatBoundAt(binding.boundAt)}</span>
            </div>
          ) : null}
        </div>

        {canStartPairing ? (
          <button
            className={`${primaryButtonClass} shrink-0`}
            type="button"
            onClick={onPair}
            disabled={health !== "ok" || isPairing || pairingInProgress}
          >
            {isPairing || (pairingInProgress && status === "connecting") ? (
              <Loader2 className="animate-spin" size={17} />
            ) : (
              <QrCode size={17} />
            )}
            {pairButtonLabel}
          </button>
        ) : binding.state === "bound" ? (
          <button
            className={`${dangerButtonClass} shrink-0`}
            type="button"
            onClick={onChangeAccount}
            disabled={health !== "ok" || isRebinding}
          >
            {isRebinding ? <Loader2 className="animate-spin" size={17} /> : <Link2Off size={17} />}
            Change account
          </button>
        ) : null}
      </div>
    </section>
  );
}
