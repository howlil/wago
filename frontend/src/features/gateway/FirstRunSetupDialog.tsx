import { KeyRound, Loader2, X } from "lucide-react";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../shared/ui/classes.js";

type FirstRunSetupDialogProps = {
  isOpen: boolean;
  setupCode: string;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onSetupCodeChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function FirstRunSetupDialog({
  isOpen,
  setupCode,
  isSubmitting,
  errorMessage,
  onSetupCodeChange,
  onCancel,
  onConfirm,
}: FirstRunSetupDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251f]/60 px-4 py-6 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
        disabled={isSubmitting}
        aria-label="Close legacy setup dialog"
      />
      <section
        className="relative w-full max-w-[480px] rounded-xl border border-[#dce5e1] bg-white p-5 shadow-[0_24px_80px_rgb(16_37_31_/_24%)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-setup-dialog-title"
        aria-describedby="first-run-setup-dialog-description"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eaf5f0] text-[#176a4c]">
              <KeyRound size={19} />
            </span>
            <div>
              <h2 id="first-run-setup-dialog-title" className="text-lg font-semibold text-[#17231f]">
                Legacy setup authorization
              </h2>
              <p id="first-run-setup-dialog-description" className="mt-1 text-sm leading-6 text-[#687970]">
                This deployment still uses the legacy SETUP_TOKEN bootstrap path. New deployments should configure
                WAGO_ADMIN_PASSWORD and sign in before pairing instead.
              </p>
            </div>
          </div>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce5e1] text-[#52675d] hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Close legacy setup dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-medium text-[#34473e]" htmlFor="first-run-setup-code">
            SETUP_TOKEN
          </label>
          <input
            id="first-run-setup-code"
            className={`${inputClass} font-mono text-xs`}
            type="password"
            value={setupCode}
            onChange={(event) => onSetupCodeChange(event.target.value)}
            autoComplete="off"
            disabled={isSubmitting}
            placeholder="Legacy deployment secret"
          />
          {errorMessage ? (
            <p className="mt-2 text-xs leading-5 text-[#9c2932]" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2 max-[520px]:flex-col-reverse">
          <button className={secondaryButtonClass} type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className={primaryButtonClass}
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || !setupCode.trim()}
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />}{" "}
            {isSubmitting ? "Authorizing" : "Continue to pairing"}
          </button>
        </div>
      </section>
    </div>
  );
}
