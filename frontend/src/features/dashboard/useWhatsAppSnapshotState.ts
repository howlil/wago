import { useCallback, useRef, useState } from "react";
import {
  type AccountHealthSnapshot,
  getCurrentQr,
  getQrImageSvg,
  getWhatsAppStatus,
  type WhatsAppBinding,
  type WhatsAppStatus,
} from "../whatsapp/api.js";

const unboundBinding: WhatsAppBinding = {
  state: "unbound",
  jid: null,
  phone: null,
  boundAt: null,
};

export function useWhatsAppSnapshotState() {
  const [status, setStatus] = useState<WhatsAppStatus>("disconnected");
  const [binding, setBinding] = useState<WhatsAppBinding>(unboundBinding);
  const [accountHealth, setAccountHealth] = useState<AccountHealthSnapshot | undefined>();
  const [hasQr, setHasQr] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);

  const statusRef = useRef<WhatsAppStatus>("disconnected");

  const updateStatus = useCallback((nextStatus: WhatsAppStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const clearWhatsAppView = useCallback(() => {
    updateStatus("disconnected");
    setBinding(unboundBinding);
    setAccountHealth(undefined);
    setHasQr(false);
    setQrImage(null);
  }, [updateStatus]);

  const refreshWhatsAppView = useCallback(async () => {
    const [statusResult, qrResult] = await Promise.all([getWhatsAppStatus(), getCurrentQr()]);
    updateStatus(statusResult.status);
    setBinding(statusResult.binding);
    setAccountHealth(statusResult.accountHealth);
    setHasQr(Boolean(qrResult.qr));
    setQrImage(qrResult.qr ? await getQrImageSvg() : null);
  }, [updateStatus]);

  const resetBinding = useCallback(
    (nextStatus: WhatsAppStatus) => {
      setBinding(unboundBinding);
      setAccountHealth(undefined);
      setHasQr(false);
      setQrImage(null);
      updateStatus(nextStatus);
    },
    [updateStatus],
  );

  const getCurrentStatus = useCallback(() => statusRef.current, []);

  return {
    status,
    binding,
    accountHealth,
    hasQr,
    qrImage,
    getCurrentStatus,
    updateStatus,
    clearWhatsAppView,
    refreshWhatsAppView,
    resetBinding,
  };
}
