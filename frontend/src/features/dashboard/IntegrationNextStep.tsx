import { ArrowRight, PlugZap } from "lucide-react";
import { secondaryButtonClass } from "../../shared/ui/classes.js";
import type { WhatsAppStatus } from "../whatsapp/api.js";

type IntegrationNextStepProps = {
  status: WhatsAppStatus;
  apiKeyConfigured: boolean;
};

export function IntegrationNextStep({ status, apiKeyConfigured }: IntegrationNextStepProps) {
  if (status !== "connected" || apiKeyConfigured) {
    return null;
  }

  return (
    <section className="mt-4 flex flex-col gap-3 rounded-lg border border-wago-line bg-[#f7f9f8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wago-brand-soft text-wago-brand-strong">
          <PlugZap size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-wago-ink">Optional application integration</div>
          <p className="mb-0 mt-0.5 text-[11px] leading-5 text-wago-muted">
            WhatsApp is connected. If another backend will call Wago, create its machine API key in Settings.
          </p>
        </div>
      </div>
      <a className={`${secondaryButtonClass} shrink-0`} href="/settings">
        Open settings
        <ArrowRight size={14} />
      </a>
    </section>
  );
}
