import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayReadinessSnapshot } from "../src/features/gateway/api.js";

const degradedReadiness: GatewayReadinessSnapshot = {
  status: "degraded",
  checks: {
    credentialPersistence: {
      status: "degraded",
      reason: "credential_persistence_failed",
    },
  },
};

const gatewayApi = vi.hoisted(() => ({
  getHealth: vi.fn(async () => ({ status: "ok" })),
  getReadiness: vi.fn(async () => ({
    status: "degraded" as const,
    checks: {
      credentialPersistence: {
        status: "degraded" as const,
        reason: "credential_persistence_failed",
      },
    },
  })),
  getAppInfo: vi.fn(async () => ({
    success: true as const,
    appId: "wa-gateway-test",
    apiKeyRequired: true,
    apiKeyConfigured: true,
    apiKeySource: "generated" as const,
    authenticated: true,
    credentialSetupRequired: false,
    setupRequired: false,
  })),
}));

const whatsappApi = vi.hoisted(() => ({
  getWhatsAppStatus: vi.fn(async () => ({
    success: true as const,
    status: "connected" as const,
    binding: {
      state: "bound" as const,
      jid: "6281234567890@s.whatsapp.net",
      phone: "6281234567890",
      boundAt: "2026-08-14T00:00:00.000Z",
    },
    accountHealth: { availability: "available" as const },
  })),
  getCurrentQr: vi.fn(async () => ({ success: true, qr: null, status: "connected" as const })),
  getQrImageSvg: vi.fn(async () => "<svg />"),
}));

vi.mock("../src/features/gateway/api.js", () => gatewayApi);
vi.mock("../src/features/whatsapp/api.js", () => whatsappApi);

import { useDashboardSnapshot } from "../src/features/dashboard/useDashboardSnapshot.js";

describe("dashboard readiness snapshot scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes readiness through the existing snapshot scheduler without adding an interval", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const { result, unmount } = renderHook(() => useDashboardSnapshot());

    expect(setIntervalSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(gatewayApi.getReadiness).toHaveBeenCalledTimes(1));
    expect(result.current.readiness).toEqual(degradedReadiness);

    unmount();
  });

  it("does not let a hanging readiness request block the main snapshot or create overlapping readiness requests", async () => {
    let resolveReadiness!: (value: GatewayReadinessSnapshot) => void;
    const readinessPromise = new Promise<GatewayReadinessSnapshot>((resolve) => {
      resolveReadiness = resolve;
    });
    gatewayApi.getReadiness.mockReturnValueOnce(readinessPromise);

    const { result, unmount } = renderHook(() => useDashboardSnapshot());

    await waitFor(() => expect(gatewayApi.getAppInfo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(whatsappApi.getWhatsAppStatus).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe("connected");

    await act(async () => {
      await result.current.refresh({ showLoading: false });
    });

    expect(gatewayApi.getReadiness).toHaveBeenCalledTimes(1);
    expect(gatewayApi.getAppInfo).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveReadiness(degradedReadiness);
      await readinessPromise;
    });
    await waitFor(() => expect(result.current.readiness).toEqual(degradedReadiness));

    unmount();
  });
});
