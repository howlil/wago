import { Link2Off, Loader2, QrCode } from "lucide-react";
import type { WhatsAppBinding, WhatsAppStatus } from "../../api.js";
import type { BackendHealthState } from "../../shared/types/status.js";
import {
  cardBodyClass,
  dangerButtonClass,
  primaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import { QrPairingCard } from "./QrPairingCard.js";

type WhatsAppBindingCardProps = {
  health: BackendHealthState;
  status: WhatsAppStatus;
  binding: WhatsAppBinding;
  qrImage: string | null;
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
  qrImage,
  connectionDescription,
  canStartPairing,
  pairingInProgress,
  pairButtonLabel,
  isPairing,
  isRebinding,
  onPair,
  onChangeAccount,
}: WhatsAppBindingCardProps) {
  const qrReady = Boolean(qrImage && status === "qr");

  return (
    <section className={cardBodyClass}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>WhatsApp connection</h2>
          <p className={sectionDescriptionClass}>{connectionDescription}</p>
        </div>

        {qrReady ? (
          <span className="inline-flex h-8 items-center gap-2 rounded-md bg-[#edf5f1] px-2.5 text-[11px] font-medium text-[#35614f]">
            <QrCode size={13} />
            Scan QR
          </span>
        ) : canStartPairing ? (
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
          <button
            className={dangerButtonClass}
            type="button"
            onClick={onChangeAccount}
            disabled={health !== "ok" || isRebinding}
          >
            {isRebinding ? <Loader2 className="animate-spin" size={15} /> : <Link2Off size={15} />}
            Change account
          </button>
        ) : null}
      </div>

      {qrImage && status !== "connected" ? (
        <div className="mt-2.5 border-t border-[#e7ebe8] pt-2.5">
          <QrPairingCard qrImage={qrImage} />
        </div>
      ) : null}

      {binding.state === "bound" ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ebe8] pt-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#2f8b67]" />
            <strong className="font-mono text-xs font-semibold text-[#285f49]">{binding.phone}</strong>
          </div>
          <span className="text-[10px] text-[#7d8882]">Bound {formatBoundAt(binding.boundAt)}</span>
        </div>
      ) : null}
    </section>
  );
}
