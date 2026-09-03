import { Link2Off, Loader2, QrCode } from "lucide-react";
import type { BackendHealthState } from "../../shared/types/status.js";
import {
  dangerButtonClass,
  keyValueClass,
  keyValueLabelClass,
  primaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
  workspaceModuleClass,
  workspaceModuleHeaderClass,
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

function connectionLabel(health: BackendHealthState, status: WhatsAppStatus): string {
  if (health !== "ok") return "Backend unavailable";
  if (status === "connected") return "Connected";
  if (status === "connecting") return "Connecting";
  if (status === "qr") return "QR ready";
  return "Disconnected";
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
    <section className={workspaceModuleClass} aria-labelledby="whatsapp-module-title">
      <div className={workspaceModuleHeaderClass}>
        <div className="min-w-0">
          <h2 id="whatsapp-module-title" className={sectionTitleClass}>
            WhatsApp
          </h2>
          <p className={sectionDescriptionClass}>{connectionDescription}</p>
        </div>

        {qrReady ? (
          <span className="shrink-0 text-xs font-medium text-wago-warning">QR ready</span>
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
        <div className="border-b border-wago-line py-4">
          <QrPairingCard qrImage={qrImage} />
        </div>
      ) : null}

      <dl className="mb-0 grid gap-4 border-b border-wago-line py-4 md:grid-cols-3 md:gap-0 md:divide-x md:divide-wago-line">
        <div className="min-w-0 md:pr-4">
          <dt className={keyValueLabelClass}>Connection</dt>
          <dd className={`${keyValueClass} mb-0`}>{connectionLabel(health, status)}</dd>
        </div>
        <div className="min-w-0 border-t border-wago-line pt-4 md:border-t-0 md:px-4 md:pt-0">
          <dt className={keyValueLabelClass}>Account</dt>
          <dd className="mb-0 mt-1 min-w-0">
            {binding.state === "bound" ? (
              <strong className="break-all font-mono text-xs font-semibold text-wago-brand-strong">
                {binding.phone}
              </strong>
            ) : (
              <span className="text-sm font-medium text-wago-muted">Not paired</span>
            )}
          </dd>
        </div>
        <div className="min-w-0 border-t border-wago-line pt-4 md:border-t-0 md:pl-4 md:pt-0">
          <dt className={keyValueLabelClass}>Bound</dt>
          <dd className="mb-0 mt-1 text-xs font-medium text-wago-ink">
            {binding.state === "bound" ? formatBoundAt(binding.boundAt) : "—"}
          </dd>
        </div>
      </dl>

      <AccountHealthCard accountHealth={accountHealth} />
    </section>
  );
}
