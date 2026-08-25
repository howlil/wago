import { type Dispatch, type SetStateAction, useState } from "react";
import { ApiError } from "../../shared/api/client.js";
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

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

export function useGatewayAccessActions({ snapshot, setNotice }: GatewayAccessActionsOptions) {
  const [signInCredential, setSignInCredential] = useState("");
  const [showSignInCredential, setShowSignInCredential] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
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
    if (snapshot.dashboardAuthMode === "unconfigured") {
      setNotice({
        type: "error",
        message: "Configure WAGO_ADMIN_PASSWORD in the deployment, then restart Wago before signing in.",
      });
      return;
    }

    const candidate = signInCredential;
    if (!candidate) {
      setNotice({
        type: "error",
        message: snapshot.dashboardAuthMode === "password" ? "Enter the admin password first." : "Enter the API key first.",
      });
      return;
    }

    setIsSigningIn(true);
    setNotice(null);
    try {
      await createBrowserSession(candidate, snapshot.dashboardAuthMode);
      setSignInCredential("");
      setShowSignInCredential(false);
      const info = await snapshot.loadAppInfo();
      if (!info.authenticated) {
        setNotice({ type: "error", message: "The backend did not establish a browser session." });
        return;
      }
      setNotice({
        type: "success",
        message:
          snapshot.dashboardAuthMode === "password"
            ? "Signed in. The admin password was not stored in this browser."
            : "Signed in through the legacy API-key recovery path. Configure WAGO_ADMIN_PASSWORD to separate dashboard and API credentials.",
      });
      await snapshot.refresh({ showLoading: true });
    } catch (error) {
      setNotice({ type: "error", message: apiErrorMessage(error, "Failed to sign in") });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setNotice(null);
    try {
      await logoutBrowserSession();
      setSignInCredential("");
      setShowSignInCredential(false);
      setApiKeyInput("");
      setShowApiKey(false);
      setIsApiKeyRotationDialogOpen(false);
      await snapshot.refresh({ showLoading: true });
      setNotice({ type: "success", message: "Signed out from this browser. External API clients are unaffected." });
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
      setSignInCredential("");
      setShowSignInCredential(false);
      setApiKeyInput("");
      setShowApiKey(false);
      setIsApiKeyRotationDialogOpen(false);
      await snapshot.refresh({ showLoading: true });
      setNotice({
        type: "success",
        message: "All dashboard sessions were revoked. Machine API clients and WhatsApp auth are unchanged.",
      });
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
    : snapshot.isAuthenticated && apiKeyInput
      ? "Shown once. Save this machine API key now; Wago does not persist it in browser storage."
      : "Machine API key for external REST clients. Dashboard sign-in uses its own browser session.";

  const signInHint =
    snapshot.dashboardAuthMode === "password"
      ? "Use WAGO_ADMIN_PASSWORD. Wago exchanges it for an HttpOnly browser session and does not store it in the browser."
      : snapshot.dashboardAuthMode === "legacy_api_key"
        ? "Compatibility mode: use the existing API key once. Configure WAGO_ADMIN_PASSWORD to remove this legacy coupling."
        : "Set WAGO_ADMIN_PASSWORD in the deployment environment and restart Wago to enable dashboard sign-in.";

  return {
    signInCredential,
    showSignInCredential,
    apiKeyInput,
    showApiKey,
    copiedField,
    isSigningIn,
    isSigningOut,
    isSigningOutAll,
    isRotatingApiKey,
    isApiKeyRotationDialogOpen,
    credentialHint,
    signInHint,
    setSignInCredential,
    setApiKeyInput,
    toggleSignInCredential: () => setShowSignInCredential((value) => !value),
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
