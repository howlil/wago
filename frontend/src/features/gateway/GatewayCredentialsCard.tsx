import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import type { AppInfoResponse } from "../../api.js";
import {
  cardBodyClass,
  inputClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import type { CopiedField } from "../dashboard/types.js";

type GatewayCredentialsCardProps = {
  appId: string;
  apiKeyConfigured: boolean;
  apiKeySource: AppInfoResponse["apiKeySource"];
  apiKeyInput: string;
  credentialSetupRequired: boolean;
  isAuthenticated: boolean;
  showApiKey: boolean;
  copiedField: CopiedField;
  credentialHint: string;
  onApiKeyChange: (value: string) => void;
  onToggleApiKey: () => void;
  onCopyAppId: () => void;
  onCopyApiKey: () => void;
  onUseApiKey: () => void;
};

export function GatewayCredentialsCard({
  appId,
  apiKeyConfigured,
  apiKeySource,
  apiKeyInput,
  credentialSetupRequired,
  isAuthenticated,
  showApiKey,
  copiedField,
  credentialHint,
  onApiKeyChange,
  onToggleApiKey,
  onCopyAppId,
  onCopyApiKey,
  onUseApiKey,
}: GatewayCredentialsCardProps) {
  return (
    <section id="credentials" className={`${cardBodyClass} scroll-mt-28`}>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f4ef] text-[#176b55]">
          <KeyRound size={19} />
        </span>
        <div>
          <h2 className={sectionTitleClass}>Gateway Credentials</h2>
          <p className={sectionDescriptionClass}>
            Stable gateway identity. Changing the WhatsApp account does not rotate it.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <label>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[#5d7067]">App ID</span>
          <div className="flex gap-2 max-[560px]:flex-col">
            <input className={`${inputClass} font-mono text-sm`} value={appId} readOnly aria-label="App ID" />
            <button className={secondaryButtonClass} type="button" onClick={onCopyAppId}>
              {copiedField === "appId" ? <Check size={16} /> : <Copy size={16} />}
              {copiedField === "appId" ? "Copied" : "Copy"}
            </button>
          </div>
        </label>

        <label>
          <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#5d7067]">
            API Key
            {apiKeyConfigured ? (
              <span className="rounded-md bg-[#eef3f1] px-1.5 py-0.5 text-[9px] tracking-[0.04em] text-[#6c7d75]">
                {apiKeySource}
              </span>
            ) : null}
          </span>
          <div className="flex gap-2 max-[560px]:flex-col">
            <div className="relative min-w-0 flex-1">
              <input
                className={`${inputClass} pr-11 font-mono text-sm`}
                value={apiKeyInput}
                onChange={(event) => onApiKeyChange(event.target.value)}
                placeholder={
                  credentialSetupRequired
                    ? "Generated automatically on first pairing"
                    : isAuthenticated
                      ? "Hidden after setup"
                      : "Enter existing API key"
                }
                type={showApiKey ? "text" : "password"}
                readOnly={credentialSetupRequired || isAuthenticated}
                autoComplete="off"
                aria-label="API Key"
              />
              {apiKeyInput ? (
                <button
                  className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-[#687970]"
                  type="button"
                  onClick={onToggleApiKey}
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              ) : null}
            </div>

            {!isAuthenticated && apiKeyConfigured ? (
              <button className={secondaryButtonClass} type="button" onClick={onUseApiKey}>
                Use key
              </button>
            ) : (
              <button className={secondaryButtonClass} type="button" onClick={onCopyApiKey} disabled={!apiKeyInput}>
                {copiedField === "apiKey" ? <Check size={16} /> : <Copy size={16} />}
                {copiedField === "apiKey" ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <span className="mt-1.5 block text-xs leading-5 text-[#718179]">{credentialHint}</span>
        </label>
      </div>
    </section>
  );
}
