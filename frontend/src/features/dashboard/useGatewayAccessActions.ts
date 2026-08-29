import { type Dispatch, type SetStateAction, useState } from "react";
import { ApiError } from "../../shared/api/client.js";
import { useClipboard } from "../../shared/hooks/useClipboard.js";
import type { Notice } from "../../shared/ui/feedback.js";
import { rotateApiKey, logoutAllBrowserSessions, logoutBrowserSession } from "../gateway/api.js";
import type { CopiedField } from "../gateway/types.js";
import { useAccessGate } from "../access/AccessGate.js";
import type { useDashboardSnapshot } from "./useDashboardSnapshot.js";

type DashboardSnapshot = ReturnType<typeof useDashboardSnapshot>;

type GatewayAccessActionsOptions = {
  snapshot: DashboardSnapshot;
  setNotice: Dispatch<SetStateAction<Notice>>;
};

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

export function useGatewayAccessActions({ snapshot, setNotice }: GatewayAccessActionsOptions) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isRotatingApiKey, setIsRotatingApiKey] = useState(false);
  const [isApiKeyRotationDialogOpen, setIsApiKeyRotationDialogOpen] = useState(false);
  const { refresh: refreshAccess } = useAccessGate();
  const { copiedField, copy } = useClipboard<Exclude<CopiedField, null>>({
    onError: (message) => setNotice({ type: "error", message }),
  });

  async function handleSignOut() {
    setIsSigningOut(true);
    setNotice(null);
    try {
      await logoutBrowserSession();
      setApiKeyInput("");
      setShowApiKey(false);
      setIsApiKeyRotationDialogOpen(false);
      await refreshAccess();
    } catch (error) {
      setNotice({ type: "error", message: apiErrorMessage(error, "Failed to sign out") });
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleSignOutAll() {
    setIsSigningOutAll(true);
    setNotice(null);
    try {
      await logoutAllBrowserSessions();
      setApiKeyInput("");
      setShowApiKey(false);
      setIsApiKeyRotationDialogOpen(false);
      await refreshAccess();
    } catch (error) {
      setNotice({ type: "error", message: apiErrorMessage(error, "Failed to sign out all sessions") });
    } finally {
      setIsSigningOutAll(false);
    }
  }

  async function handleRotateApiKey() {
    if (!snapshot.isAuthenticated || snapshot.apiKeySource !== "generated") {
      setNotice({ type: "error", message: "Only generated API keys can be rotated from the dashboard." });
      return;
    }
    setIsRotatingApiKey(true);
    setNotice(null);
    try {
      const result = await rotateApiKey();
      setApiKeyInput(result.apiKey);
      setShowApiKey(true);
      setIsApiKeyRotationDialogOpen(false);
      setNotice({
        type: "success",
        message: `API key rotated and ${result.revokedBrowserSessions ?? 0} other dashboard session(s) revoked. Save the new key now.`,
      });
    } catch (error) {
      setNotice({ type: "error", message: apiErrorMessage(error, "Failed to rotate API key") });
    } finally {
      setIsRotatingApiKey(false);
    }
  }

  const credentialHint = snapshot.credentialSetupRequired
    ? "Generated once after first pairing. Save it for external REST clients and automation."
    : snapshot.apiKeySource === "generated" && apiKeyInput
      ? "Shown once. Save this machine API key now; Wago does not persist it in browser storage."
      : "Machine API key for external REST clients. Dashboard authentication is managed separately.";

  return {
    apiKeyInput,
    showApiKey,
    copiedField,
    isSigningOut,
    isSigningOutAll,
    isRotatingApiKey,
    isApiKeyRotationDialogOpen,
    credentialHint,
    setApiKeyInput,
    toggleApiKey: () => setShowApiKey((value) => !value),
    copyAppId: () => void copy(snapshot.appId, "appId"),
    copyApiKey: () => void copy(apiKeyInput, "apiKey"),
    handleSignOut,
    handleSignOutAll,
    handleRotateApiKey,
    openApiKeyRotationDialog: () => setIsApiKeyRotationDialogOpen(true),
    closeApiKeyRotationDialog: () => setIsApiKeyRotationDialogOpen(false),
  };
}
