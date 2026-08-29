import { Eye, EyeOff } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ApiError } from "../../shared/api/client.js";
import { fieldLabelClass, inputClass, primaryButtonClass, secondaryButtonClass } from "../../shared/ui/classes.js";
import {
  type AppInfoResponse,
  createAdminAccount,
  createBrowserSession,
  getAppInfo,
} from "../gateway/api.js";

type AccessGateProps = {
  children: ReactNode;
};

type AccessContextValue = {
  refresh: () => Promise<void>;
};

const AccessContext = createContext<AccessContextValue | null>(null);

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

function AccessFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-wago-brand text-lg font-semibold text-white">
            W
          </div>
          <div className="mt-3 text-sm font-semibold tracking-[-0.01em] text-wago-ink">Wago</div>
        </div>
        {children}
      </div>
    </main>
  );
}

function AccessForm({ info, onRefresh }: { info: AppInfoResponse; onRefresh: () => Promise<void> }) {
  const creatingAccount = info.dashboardAuthMode === "setup";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!password) {
      setSubmitError(creatingAccount ? "Create an admin password first." : "Enter the admin password first.");
      return;
    }

    if (creatingAccount && password !== confirmation) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (creatingAccount) {
        await createAdminAccount(password);
      } else {
        await createBrowserSession(password);
      }
      await onRefresh();
    } catch (error) {
      if (creatingAccount && error instanceof ApiError && error.code === "ADMIN_ALREADY_CONFIGURED") {
        await onRefresh();
        return;
      }
      setSubmitError(errorMessage(error, creatingAccount ? "Failed to set up Wago" : "Failed to sign in"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-wago-line bg-wago-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-[-0.02em] text-wago-ink">
        {creatingAccount ? "Set up your gateway" : "Sign in"}
      </h1>
      <p className="mb-0 mt-1.5 text-sm leading-6 text-wago-muted">
        {creatingAccount
          ? "Create the admin password that protects this Wago dashboard. No .env credential is required."
          : "Enter the admin password created during first-run setup."}
      </p>

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <div>
          <label className={fieldLabelClass} htmlFor="wago-admin-password">
            Admin password
          </label>
          <div className="relative">
            <input
              id="wago-admin-password"
              className={`${inputClass} pr-10`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder={creatingAccount ? "12+ characters" : "Admin password"}
              autoComplete={creatingAccount ? "new-password" : "current-password"}
              autoFocus
            />
            {password ? (
              <button
                className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-[#758079]"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide admin password" : "Show admin password"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            ) : null}
          </div>
        </div>

        {creatingAccount ? (
          <div>
            <label className={fieldLabelClass} htmlFor="wago-admin-password-confirmation">
              Confirm password
            </label>
            <input
              id="wago-admin-password-confirmation"
              className={inputClass}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Repeat admin password"
              autoComplete="new-password"
            />
          </div>
        ) : null}

        {submitError ? (
          <div className="rounded-md border border-[#e4b8bc] bg-wago-danger-soft px-3 py-2 text-xs leading-5 text-wago-danger" role="alert">
            {submitError}
          </div>
        ) : null}

        <button className={`${primaryButtonClass} mt-1 w-full`} type="submit" disabled={isSubmitting}>
          {isSubmitting ? (creatingAccount ? "Setting up" : "Signing in") : creatingAccount ? "Set up Wago" : "Sign in"}
        </button>
      </form>

      {creatingAccount ? (
        <p className="mb-0 mt-4 text-center text-[11px] leading-5 text-wago-muted">
          Wago stores only a salted password hash in its private SQLite state.
        </p>
      ) : null}
    </section>
  );
}

export function useAccessGate(): AccessContextValue {
  const value = useContext(AccessContext);
  if (!value) {
    throw new Error("useAccessGate must be used inside AccessGate");
  }
  return value;
}

export function AccessGate({ children }: AccessGateProps) {
  const [info, setInfo] = useState<AppInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setInfo(await getAppInfo());
    } catch (error) {
      setInfo(null);
      setLoadError(errorMessage(error, "Failed to load Wago access state"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (isLoading) {
    return (
      <AccessFrame>
        <section className="rounded-xl border border-wago-line bg-wago-surface p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-wago-ink">Loading Wago</h1>
          <p className="mb-0 mt-1.5 text-sm text-wago-muted">Checking dashboard access.</p>
        </section>
      </AccessFrame>
    );
  }

  if (!info || loadError) {
    return (
      <AccessFrame>
        <section className="rounded-xl border border-wago-line bg-wago-surface p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-wago-ink">Wago is unavailable</h1>
          <p className="mb-0 mt-1.5 text-sm leading-6 text-wago-muted">{loadError ?? "Access state is unavailable."}</p>
          <button className={`${secondaryButtonClass} mt-5`} type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </section>
      </AccessFrame>
    );
  }

  if (!info.authenticated) {
    return (
      <AccessFrame>
        <AccessForm info={info} onRefresh={refresh} />
      </AccessFrame>
    );
  }

  return <AccessContext.Provider value={{ refresh }}>{children}</AccessContext.Provider>;
}
