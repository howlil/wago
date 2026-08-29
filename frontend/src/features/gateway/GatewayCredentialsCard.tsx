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
  dashboardAuthMode: AppInfoResponse["dashboardAuthMode"];
  signInCredential: string;
  apiKeyInput: string;
  credentialSetupRequired: boolean;
  isAuthenticated: boolean;
  showSignInCredential: boolean;
  showApiKey: boolean;
  copiedField: CopiedField;
  credentialHint: string;
  signInHint: string;
  isSigningIn: boolean;
  isSigningOut: boolean;
  isSigningOutAll?: boolean;
  isRotatingApiKey: boolean;
  onSignInCredentialChange: (value: string) => void;
  onToggleSignInCredential: () => void;
  onToggleApiKey: () => void;
  onCopyAppId: () => void;
  onCopyApiKey: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSignOutAll?: () => void;
  onRotateApiKey: () => void;
};

export function GatewayCredentialsCard({
  appId,
  apiKeyConfigured,
  apiKeySource,
  dashboardAuthMode,
  signInCredential,
  apiKeyInput,
  credentialSetupRequired,
  isAuthenticated,
  showSignInCredential,
  showApiKey,
  copiedField,
  credentialHint,
  signInHint,
  isSigningIn,
  isSigningOut,
  isSigningOutAll = false,
  isRotatingApiKey,
  onSignInCredentialChange,
  onToggleSignInCredential,
  onToggleApiKey,
  onCopyAppId,
  onCopyApiKey,
  onSignIn,
  onSignOut,
  onSignOutAll,
  onRotateApiKey,
}: GatewayCredentialsCardProps) {
  const signInLabel = "Admin password";

  return (
    <section className={cardBodyClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>Gateway access</h2>
          <p className={sectionDescriptionClass}>
            Dashboard access and machine API credentials are intentionally separate.
          </p>
        </div>
        {apiKeyConfigured ? (
          <span className="shrink-0 rounded bg-[#f0f2f0] px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.05em] text-[#6f7c75]">
            {apiKeySource}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4">
        {!isAuthenticated ? (
          <div>
            <label className={fieldLabelClass} htmlFor="gateway-sign-in-credential">
              {signInLabel}
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative min-w-0">
                <input
                  id="gateway-sign-in-credential"
                  className={`${inputClass} pr-9 text-xs`}
                  value={signInCredential}
                  onChange={(event) => onSignInCredentialChange(event.target.value)}
                  placeholder={
                    dashboardAuthMode === "password" ? "WAGO_ADMIN_PASSWORD" : "Configure WAGO_ADMIN_PASSWORD"
                  }
                  type={showSignInCredential ? "text" : "password"}
                  disabled={dashboardAuthMode === "unconfigured"}
                  autoComplete={dashboardAuthMode === "password" ? "current-password" : "off"}
                  aria-label={signInLabel}
                />
                {signInCredential ? (
                  <button
                    className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center text-[#758079]"
                    type="button"
                    onClick={onToggleSignInCredential}
                    aria-label={showSignInCredential ? `Hide ${signInLabel}` : `Show ${signInLabel}`}
                  >
                    {showSignInCredential ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                ) : null}
              </div>
              <button
                className={`${secondaryButtonClass} w-full sm:w-auto`}
                type="button"
                onClick={onSignIn}
                disabled={isSigningIn || dashboardAuthMode === "unconfigured"}
              >
                {isSigningIn ? "Signing in" : "Sign in"}
              </button>
            </div>
            <span className="mt-1 block text-[10px] leading-4 text-[#7b8680]">{signInHint}</span>
          </div>
        ) : null}

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
                placeholder={credentialSetupRequired ? "Generated after first pairing" : "Not stored in browser"}
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

        {isAuthenticated ? (
          <div className="flex flex-col justify-end gap-2 sm:flex-row">
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
                disabled={isSigningOutAll || isRotatingApiKey}
              >
                <LogOut size={14} />
                {isSigningOutAll ? "Signing out all" : "Sign out all"}
              </button>
            ) : null}
            <button
              className={`${secondaryButtonClass} w-full sm:w-auto`}
              type="button"
              onClick={onSignOut}
              disabled={isSigningOut || isSigningOutAll || isRotatingApiKey}
            >
              <LogOut size={14} />
              {isSigningOut ? "Signing out" : "Sign out"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
