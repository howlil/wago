import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import {
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
  workspaceModuleClass,
  workspaceModuleHeaderClass,
} from "../../shared/ui/classes.js";
import type { CopiedField } from "./types.js";

type GatewayCredentialsCardProps = {
  appId: string;
  apiKeyConfigured: boolean;
  apiKeyInput: string;
  showApiKey: boolean;
  copiedField: CopiedField;
  credentialHint: string;
  isGeneratingApiKey: boolean;
  isRotatingApiKey: boolean;
  onToggleApiKey: () => void;
  onCopyAppId: () => void;
  onCopyApiKey: () => void;
  onGenerateApiKey: () => void;
  onRotateApiKey: () => void;
};

export function GatewayCredentialsCard({
  appId,
  apiKeyConfigured,
  apiKeyInput,
  showApiKey,
  copiedField,
  credentialHint,
  isGeneratingApiKey,
  isRotatingApiKey,
  onToggleApiKey,
  onCopyAppId,
  onCopyApiKey,
  onGenerateApiKey,
  onRotateApiKey,
}: GatewayCredentialsCardProps) {
  return (
    <section className={workspaceModuleClass} aria-labelledby="machine-access-title">
      <div className={workspaceModuleHeaderClass}>
        <div className="min-w-0">
          <h2 id="machine-access-title" className={sectionTitleClass}>
            Machine access
          </h2>
          <p className={sectionDescriptionClass}>Credentials for applications calling the Wago HTTP API.</p>
        </div>
      </div>

      <div className="grid border-b border-wago-line py-4 xl:grid-cols-2 xl:divide-x xl:divide-wago-line">
        <div className="min-w-0 pb-4 xl:pb-0 xl:pr-6">
          <div className="text-[11px] font-medium text-wago-secondary">App ID</div>
          <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
            <code className="min-w-0 break-all font-mono text-xs text-wago-ink">{appId}</code>
            <button className={`${secondaryButtonClass} shrink-0`} type="button" onClick={onCopyAppId}>
              {copiedField === "appId" ? <Check size={14} /> : <Copy size={14} />}
              {copiedField === "appId" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="min-w-0 border-t border-wago-line pt-4 xl:border-t-0 xl:pl-6 xl:pt-0">
          <div className="text-[11px] font-medium text-wago-secondary">Machine API key</div>
          {apiKeyConfigured ? (
            <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <strong className="block text-sm font-semibold text-wago-ink">Configured</strong>
                <p className="mb-0 mt-0.5 max-w-prose text-xs leading-5 text-wago-muted">{credentialHint}</p>
              </div>
              <button
                className={`${secondaryButtonClass} w-full shrink-0 sm:w-auto`}
                type="button"
                onClick={onRotateApiKey}
                disabled={isRotatingApiKey}
              >
                <KeyRound size={14} />
                {isRotatingApiKey ? "Rotating" : "Rotate API key"}
              </button>
            </div>
          ) : (
            <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <strong className="block text-sm font-semibold text-wago-ink">Not generated</strong>
                <p className="mb-0 mt-0.5 max-w-prose text-xs leading-5 text-wago-muted">
                  Required only when another application needs to call Wago.
                </p>
              </div>
              <button
                className={`${secondaryButtonClass} w-full shrink-0 sm:w-auto`}
                type="button"
                onClick={onGenerateApiKey}
                disabled={isGeneratingApiKey}
              >
                <KeyRound size={14} />
                {isGeneratingApiKey ? "Generating" : "Generate API key"}
              </button>
            </div>
          )}
        </div>
      </div>

      {apiKeyInput ? (
        <div className="mt-4 rounded-md border border-wago-line bg-wago-surface-subtle p-3">
          <strong className="block text-xs font-semibold text-wago-ink">New API key</strong>
          <p className="mb-2 mt-0.5 max-w-prose text-xs leading-5 text-wago-muted">
            Copy this value now. Wago will not show the raw key again after this response.
          </p>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center border-b border-wago-line py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-wago-ink">
                {showApiKey ? apiKeyInput : "•".repeat(Math.min(Math.max(apiKeyInput.length, 16), 40))}
              </code>
              <button
                className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-wago-muted hover:bg-wago-hover hover:text-wago-ink"
                type="button"
                onClick={onToggleApiKey}
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button className={`${secondaryButtonClass} w-full sm:w-auto`} type="button" onClick={onCopyApiKey}>
              {copiedField === "apiKey" ? <Check size={14} /> : <Copy size={14} />}
              {copiedField === "apiKey" ? "Copied" : "Copy key"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
