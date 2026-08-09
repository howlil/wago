import { Link2Off, Loader2, QrCode } from "lucide-react";
import type { WhatsAppBinding, WhatsAppStatus } from "../../api.js";
import { cardBodyClass, dangerButtonClass, primaryButtonClass, sectionDescriptionClass, sectionTitleClass } from "../../shared/ui/classes.js";
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
    <section className={cardBodyClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>WhatsApp connection</h2>
          <p className={sectionDescriptionClass}>{connectionDescription}</p>
        </div>

        {canStartPairing ? (
          <button
            className={primaryButtonClass}
            type="button"
            onClick={onPair}
            disabled={health !== "ok" || isPairing || pairingInProgress}
          >
            {isPairing || (pairingInProgress && status === "connecting") ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <QrCode size={15} />
            )}
            {pairButtonLabel}
          </button>
        ) : binding.state === "bound" ? (
          <button className={dangerButtonClass} type="button" onClick={onChangeAccount} disabled={health !== "ok" || isRebinding}>
            {isRebinding ? <Loader2 className="animate-spin" size={15} /> : <Link2Off size={15} />}
            Change account
          </button>
        ) : null}
      </div>

      {binding.state === "bound" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ebe8] pt-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#2f8b67]" />
            <strong className="font-mono text-sm font-semibold text-[#285f49]">{binding.phone}</strong>
          </div>
          <span className="text-[11px] text-[#7d8882]">Bound {formatBoundAt(binding.boundAt)}</span>
        </div>
      ) : null}
    </section>
  );
}
