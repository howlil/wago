import { Check, Copy, Eye, EyeOff, KeyRound, LogOut } from "lucide-react";
import {
  cardBodyClass,
  fieldLabelClass,
  inputClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import type { AppInfoResponse } from "./api.js";
import type { CopiedField } from "./types.js";

type GatewayCredentialsCardProps = {
  appId: string;
  apiKeyConfigured: boolean;
  apiKeySource: AppInfoResponse["apiKeySource"];
  apiKeyInput: string;
  credentialSetupRequired: boolean;
  showApiKey: boolean;
  copiedField: CopiedField;
  credentialHint: string;
  isGeneratingApiKey: boolean;
  isSigningOut: boolean;
  isSigningOutAll?: boolean;
  isRotatingApiKey: boolean;
  onToggleApiKey: () => void;
  onCopyAppId: () => void;
  onCopyApiKey: () => void;
  onGenerateApiKey: () => void;
  onSignOut: () => void;
  onSignOutAll?: () => void;
  onRotateApiKey: () => void;
};

export function GatewayCredentialsCard({
  appId,
  apiKeyConfigured,
  apiKeySource,
  apiKeyInput,
  credentialSetupRequired,
  showApiKey,
  copiedField,
  credentialHint,
  isGeneratingApiKey,
  isSigningOut,
  isSigningOutAll = false,
  isRotatingApiKey,
  onToggleApiKey,
  onCopyAppId,
  onCopyApiKey,
  onGenerateApiKey,
  onSignOut,
  onSignOutAll,
  onRotateApiKey,
}: GatewayCredentialsCardProps) {
  return (
    <section className={cardBodyClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>Gateway access</h2>
          <p className={sectionDescriptionClass}>
            Machine API credentials are optional and separate from dashboard authentication.
          </p>
        </div>
        {apiKeyConfigured ? (
          <span className="shrink-0 rounded bg-[#f0f2f0] px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.05em] text-[#6f7c75]">
            {apiKeySource}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4">
        <div>
          <label className={fieldLabelClass} htmlFor="gateway-app-id">
            App ID
          </label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              id="gateway-app-id"
              className={`${inputClass} min-w-0 font-mono text-xs`}
              value={appId}
              readOnly
              aria-label="App ID"
            />
            <button className={`${secondaryButtonClass} w-full sm:w-auto`} type="button" onClick={onCopyAppId}>
              {copiedField === "appId" ? <Check size={14} /> : <Copy size={14} />}
              {copiedField === "appId" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <label className={fieldLabelClass} htmlFor="gateway-api-key">
            Machine API key
          </label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-w-0">
              <input
                id="gateway-api-key"
                className={`${inputClass} pr-9 font-mono text-xs`}
                value={apiKeyInput}
                placeholder={credentialSetupRequired ? "Not generated" : "Not stored in browser"}
                type={showApiKey ? "text" : "password"}
                readOnly
                autoComplete="off"
                aria-label="Machine API key"
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
            <button
              className={`${secondaryButtonClass} w-full sm:w-auto`}
              type="button"
              onClick={onCopyApiKey}
              disabled={!apiKeyInput}
            >
              {copiedField === "apiKey" ? <Check size={14} /> : <Copy size={14} />}
              {copiedField === "apiKey" ? "Copied" : "Copy"}
            </button>
          </div>
          <span className="mt-1 block text-[10px] leading-4 text-[#7b8680]">{credentialHint}</span>
        </div>

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          {!apiKeyConfigured ? (
            <button
              className={`${secondaryButtonClass} w-full sm:w-auto`}
              type="button"
              onClick={onGenerateApiKey}
              disabled={isGeneratingApiKey}
            >
              <KeyRound size={14} />
              {isGeneratingApiKey ? "Generating" : "Generate API key"}
            </button>
          ) : null}
          {apiKeySource === "generated" ? (
            <button
              className={`${secondaryButtonClass} w-full sm:w-auto`}
              type="button"
              onClick={onRotateApiKey}
              disabled={isRotatingApiKey}
            >
              <KeyRound size={14} />
              {isRotatingApiKey ? "Rotating" : "Rotate API key"}
            </button>
          ) : null}
          {onSignOutAll ? (
            <button
              className={`${secondaryButtonClass} w-full sm:w-auto`}
              type="button"
              onClick={onSignOutAll}
              disabled={isSigningOutAll || isRotatingApiKey || isGeneratingApiKey}
            >
              <LogOut size={14} />
              {isSigningOutAll ? "Signing out all" : "Sign out all"}
            </button>
          ) : null}
          <button
            className={`${secondaryButtonClass} w-full sm:w-auto`}
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut || isSigningOutAll || isRotatingApiKey || isGeneratingApiKey}
          >
            <LogOut size={14} />
            {isSigningOut ? "Signing out" : "Sign out"}
          </button>
        </div>
      </div>
    </section>
  );
}
