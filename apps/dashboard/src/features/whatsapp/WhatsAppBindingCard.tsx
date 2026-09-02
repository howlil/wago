import { Link2Off, Loader2, QrCode } from "lucide-react";
import type { BackendHealthState } from "../../shared/types/status.js";
import {
  cardBodyClass,
  dangerButtonClass,
  primaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import { AccountHealthCard } from "./AccountHealthCard.js";
import type { AccountHealthSnapshot, WhatsAppBinding, WhatsAppStatus } from "./api.js";
import { QrPairingCard } from "./QrPairingCard.js";

type WhatsAppBindingCardProps = {
  health: BackendHealthState;
  status: WhatsAppStatus;
  binding: WhatsAppBinding;
  accountHealth?: AccountHealthSnapshot;
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
  accountHealth,
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
  const showPairAction = canStartPairing || binding.state === "unbound";

  return (
    <section className={cardBodyClass}>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>WhatsApp</h2>
          <p className={sectionDescriptionClass}>{connectionDescription}</p>
        </div>

        {qrReady ? (
          <span className="inline-flex h-8 w-fit items-center gap-2 rounded-md bg-[#edf5f1] px-2.5 text-[11px] font-medium text-[#35614f]">
            <QrCode size={13} />
            Scan QR
          </span>
        ) : showPairAction ? (
          <button
            className={`${primaryButtonClass} w-full shrink-0 sm:w-auto`}
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
            className={`${dangerButtonClass} w-full shrink-0 sm:w-auto`}
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
        <div className="mt-3 border-t border-wago-line pt-3">
          <QrPairingCard qrImage={qrImage} />
        </div>
      ) : null}

      <dl className="mb-0 mt-4 grid gap-2 border-t border-wago-line pt-3 text-[11px] sm:grid-cols-[120px_minmax(0,1fr)]">
        <dt className="font-medium text-wago-muted">Connection</dt>
        <dd className="mb-0 font-medium text-wago-ink">{connectionDescription}</dd>
        <dt className="font-medium text-wago-muted">Account</dt>
        <dd className="mb-0 min-w-0">
          {binding.state === "bound" ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong className="break-all font-mono text-xs font-semibold text-[#285f49]">{binding.phone}</strong>
              <span className="text-[10px] text-[#7d8882]">Bound {formatBoundAt(binding.boundAt)}</span>
            </span>
          ) : (
            <span className="text-wago-muted">Not paired</span>
          )}
        </dd>
      </dl>

      <AccountHealthCard accountHealth={accountHealth} />
    </section>
  );
}
