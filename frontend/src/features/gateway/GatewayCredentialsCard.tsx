import { Check, Copy, Eye, EyeOff } from "lucide-react";
import type { AppInfoResponse } from "../../api.js";
import {
  cardBodyClass,
  fieldLabelClass,
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
    <section className={cardBodyClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={sectionTitleClass}>Gateway credentials</h2>
          <p className={sectionDescriptionClass}>Stable identity for API clients.</p>
        </div>
        {apiKeyConfigured ? (
          <span className="rounded bg-[#f0f2f0] px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.05em] text-[#6f7c75]">
            {apiKeySource}
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2.5">
        <label>
          <span className={fieldLabelClass}>App ID</span>
          <div className="flex gap-2">
            <input className={`${inputClass} min-w-0 font-mono text-xs`} value={appId} readOnly aria-label="App ID" />
            <button className={`${secondaryButtonClass} shrink-0`} type="button" onClick={onCopyAppId}>
              {copiedField === "appId" ? <Check size={14} /> : <Copy size={14} />}
              {copiedField === "appId" ? "Copied" : "Copy"}
            </button>
          </div>
        </label>

        <label>
          <span className={fieldLabelClass}>API key</span>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                className={`${inputClass} pr-9 font-mono text-xs`}
                value={apiKeyInput}
                onChange={(event) => onApiKeyChange(event.target.value)}
                placeholder={
                  credentialSetupRequired
                    ? "Generated on first pairing"
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
                  className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center text-[#758079]"
                  type="button"
                  onClick={onToggleApiKey}
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              ) : null}
            </div>
            {!isAuthenticated && apiKeyConfigured ? (
              <button className={`${secondaryButtonClass} shrink-0`} type="button" onClick={onUseApiKey}>
                Use key
              </button>
            ) : (
              <button
                className={`${secondaryButtonClass} shrink-0`}
                type="button"
                onClick={onCopyApiKey}
                disabled={!apiKeyInput}
              >
                {copiedField === "apiKey" ? <Check size={14} /> : <Copy size={14} />}
                {copiedField === "apiKey" ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <span className="mt-1 block text-[10px] leading-4 text-[#7b8680]">{credentialHint}</span>
        </label>
      </div>
    </section>
  );
}
