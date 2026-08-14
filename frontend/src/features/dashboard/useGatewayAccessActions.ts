import { type Dispatch, type SetStateAction, useState } from "react";
import { useClipboard } from "../../shared/hooks/useClipboard.js";
import type { Notice } from "../../shared/ui/feedback.js";
import { createBrowserSession, logoutAllBrowserSessions, logoutBrowserSession, rotateApiKey } from "../gateway/api.js";
import type { CopiedField } from "../gateway/types.js";
import type { useDashboardSnapshot } from "./useDashboardSnapshot.js";

type DashboardSnapshot = ReturnType<typeof useDashboardSnapshot>;

type GatewayAccessActionsOptions = {
  snapshot: DashboardSnapshot;
  setNotice: Dispatch<SetStateAction<Notice>>;
};

export function useGatewayAccessActions({ snapshot, setNotice }: GatewayAccessActionsOptions) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [setupTokenInput, setSetupTokenInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isRotatingApiKey, setIsRotatingApiKey] = useState(false);
  const [isApiKeyRotationDialogOpen, setIsApiKeyRotationDialogOpen] = useState(false);
  const { copiedField, copy } = useClipboard<Exclude<CopiedField, null>>({
    onError: (message) => setNotice({ type: "error", message }),
  });

  async function handleSignIn() {
    const candidate = apiKeyInput.trim();
    if (!candidate) {
      setNotice({ type: "error", message: "Enter the API key first." });
      return;
    }
    setIsSigningIn(true);
    setNotice(null);
    try {
      const result = await createBrowserSession(candidate);
      if (!result.success) {
        setNotice({ type: "error", message: result.message });
        return;
      }
      setApiKeyInput("");
      setShowApiKey(false);
      const info = await snapshot.loadAppInfo();
      if (!info.authenticated) {
        setNotice({ type: "error", message: "The backend did not establish a browser session." });
        return;
      }
      setNotice({ type: "success", message: "Signed in. The API key was not stored in this browser." });
      await snapshot.refresh({ showLoading: true });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to sign in" });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setNotice(null);
    try {
      await logoutBrowserSession();
      setApiKeyInput("");
      setShowApiKey(false);
      setIsApiKeyRotationDialogOpen(false);
      await snapshot.refresh({ showLoading: true });
      setNotice({ type: "success", message: "Signed out from this browser. External API clients are unaffected." });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to sign out" });
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
      await snapshot.refresh({ showLoading: true });
      setNotice({
        type: "success",
        message: "All dashboard sessions were revoked. Machine API clients and WhatsApp auth are unchanged.",
      });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to sign out all sessions" });
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
      if (!result.success) {
        setNotice({ type: "error", message: result.message });
        return;
      }
      setApiKeyInput(result.apiKey);
      setShowApiKey(true);
      setIsApiKeyRotationDialogOpen(false);
      setNotice({
        type: "success",
        message: `API key rotated and ${result.revokedBrowserSessions} other dashboard session(s) revoked. Save the new key now.`,
      });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to rotate API key" });
    } finally {
      setIsRotatingApiKey(false);
    }
  }

  const credentialHint = snapshot.credentialSetupRequired
    ? "Generated once after authorized first pairing. Save it for API clients and browser recovery."
    : snapshot.isAuthenticated && apiKeyInput
      ? "Shown once. Save this API key now; Wago does not persist it in browser storage."
      : snapshot.isAuthenticated
        ? "Dashboard access uses a separate secure browser session. API keys remain for external REST clients."
        : "Enter the existing API key once to create a browser session. It will not be stored in this browser.";

  return {
    apiKeyInput,
    setupTokenInput,
    showApiKey,
    copiedField,
    isSigningIn,
    isSigningOut,
    isSigningOutAll,
    isRotatingApiKey,
    isApiKeyRotationDialogOpen,
    credentialHint,
    setApiKeyInput,
    setSetupTokenInput,
    toggleApiKey: () => setShowApiKey((value) => !value),
    copyAppId: () => void copy(snapshot.appId, "appId"),
    copyApiKey: () => void copy(apiKeyInput, "apiKey"),
    handleSignIn,
    handleSignOut,
    handleSignOutAll,
    handleRotateApiKey,
    openApiKeyRotationDialog: () => setIsApiKeyRotationDialogOpen(true),
    closeApiKeyRotationDialog: () => setIsApiKeyRotationDialogOpen(false),
  };
}
