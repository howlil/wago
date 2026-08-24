import { useState } from "react";
import type { Notice } from "../../shared/ui/feedback.js";
import { useMessageComposer } from "../messages/useMessageComposer.js";
import { allowRecipient } from "../recipients/api.js";
import { useDashboardSnapshot } from "./useDashboardSnapshot.js";
import { useGatewayAccessActions } from "./useGatewayAccessActions.js";
import { useWhatsAppBindingActions } from "./useWhatsAppBindingActions.js";

export function useDashboardController() {
  const snapshot = useDashboardSnapshot();
  const [notice, setNotice] = useState<Notice>(null);
  const access = useGatewayAccessActions({ snapshot, setNotice });
  const bindingActions = useWhatsAppBindingActions({
    snapshot,
    setNotice,
    apiKeyInput: access.apiKeyInput,
    setApiKeyInput: access.setApiKeyInput,
  });
  const messaging = useMessageComposer({
    isAuthenticated: snapshot.isAuthenticated,
    status: snapshot.status,
    onNotice: setNotice,
    onAfterMutation: () => snapshot.refresh({ showLoading: false }),
    onAllowRecipient: allowRecipient,
  });

  return {
    health: snapshot.health,
    readiness: snapshot.readiness,
    appId: snapshot.appId,
    apiKeyConfigured: snapshot.apiKeyConfigured,
    apiKeySource: snapshot.apiKeySource,
    credentialSetupRequired: snapshot.credentialSetupRequired,
    setupCodeRequired: snapshot.setupCodeRequired,
    webBootstrapEnabled: snapshot.webBootstrapEnabled,
    isAuthenticated: snapshot.isAuthenticated,
    status: snapshot.status,
    binding: snapshot.binding,
    accountHealth: snapshot.accountHealth,
    hasQr: snapshot.hasQr,
    qrImage: snapshot.qrImage,
    isRefreshing: snapshot.isRefreshing,
    refresh: snapshot.refresh,
    notice,
    apiKeyInput: access.apiKeyInput,
    showApiKey: access.showApiKey,
    copiedField: access.copiedField,
    isSigningIn: access.isSigningIn,
    isSigningOut: access.isSigningOut,
    isSigningOutAll: access.isSigningOutAll,
    isRotatingApiKey: access.isRotatingApiKey,
    isApiKeyRotationDialogOpen: access.isApiKeyRotationDialogOpen,
    credentialHint: access.credentialHint,
    setApiKeyInput: access.setApiKeyInput,
    toggleApiKey: access.toggleApiKey,
    copyAppId: access.copyAppId,
    copyApiKey: access.copyApiKey,
    handleSignIn: access.handleSignIn,
    handleSignOut: access.handleSignOut,
    handleSignOutAll: access.handleSignOutAll,
    handleRotateApiKey: access.handleRotateApiKey,
    openApiKeyRotationDialog: access.openApiKeyRotationDialog,
    closeApiKeyRotationDialog: access.closeApiKeyRotationDialog,
    isRebinding: bindingActions.isRebinding,
    isPairing: bindingActions.isPairing,
    isRebindDialogOpen: bindingActions.isRebindDialogOpen,
    isFirstRunSetupDialogOpen: bindingActions.isFirstRunSetupDialogOpen,
    setupCodeInput: bindingActions.setupCodeInput,
    setupCodeError: bindingActions.setupCodeError,
    canStartPairing: bindingActions.canStartPairing,
    pairingInProgress: bindingActions.pairingInProgress,
    connectionDescription: bindingActions.connectionDescription,
    pairButtonLabel: bindingActions.pairButtonLabel,
    setSetupCodeInput: bindingActions.setSetupCodeInput,
    handlePair: bindingActions.handlePair,
    handleConfirmFirstRunSetup: bindingActions.handleConfirmFirstRunSetup,
    handleRebind: bindingActions.handleRebind,
    openRebindDialog: bindingActions.openRebindDialog,
    closeRebindDialog: bindingActions.closeRebindDialog,
    closeFirstRunSetupDialog: bindingActions.closeFirstRunSetupDialog,
    phone: messaging.phone,
    message: messaging.message,
    recipientApprovalPhone: messaging.recipientApprovalPhone,
    recipientRefreshKey: messaging.recipientRefreshKey,
    lastMessage: messaging.lastMessage,
    isSending: messaging.isSending,
    canSend: messaging.canSend,
    approvalRequired: messaging.approvalRequired,
    handlePhoneChange: messaging.handlePhoneChange,
    setMessage: messaging.setMessage,
    handleSubmit: messaging.handleSubmit,
    allowAndSend: messaging.allowAndSend,
    handleRecipientAllowed: messaging.handleRecipientAllowed,
  };
}

export type DashboardController = ReturnType<typeof useDashboardController>;
