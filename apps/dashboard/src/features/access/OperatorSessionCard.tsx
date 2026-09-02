import { LogOut } from "lucide-react";
import { useState } from "react";
import {
  cardBodyClass,
  dangerButtonClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";

type OperatorSessionCardProps = {
  isSigningOut: boolean;
  isSigningOutAll: boolean;
  onSignOut: () => void;
  onSignOutAll: () => void;
};

export function OperatorSessionCard({
  isSigningOut,
  isSigningOutAll,
  onSignOut,
  onSignOutAll,
}: OperatorSessionCardProps) {
  const [confirmAll, setConfirmAll] = useState(false);
  const busy = isSigningOut || isSigningOutAll;

  return (
    <section className={cardBodyClass}>
      <div className="min-w-0">
        <h2 className={sectionTitleClass}>Dashboard session</h2>
        <p className={sectionDescriptionClass}>Browser access uses the admin password, separate from machine API credentials.</p>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-wago-line pt-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <strong className="block text-xs font-semibold text-wago-ink">Current browser</strong>
          <p className="mb-0 mt-0.5 text-xs leading-5 text-wago-muted">Authenticated dashboard session.</p>
        </div>
        <button
          className={`${secondaryButtonClass} w-full sm:w-auto`}
          type="button"
          onClick={onSignOut}
          disabled={busy}
        >
          <LogOut size={14} />
          {isSigningOut ? "Signing out" : "Sign out"}
        </button>
      </div>

      <div className="mt-4 border-t border-wago-line pt-3">
        <strong className="block text-xs font-semibold text-wago-ink">All browser sessions</strong>
        <p className="mb-0 mt-0.5 text-xs leading-5 text-wago-muted">
          Revoke every authenticated dashboard browser, including this one.
        </p>

        {confirmAll ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-xs font-medium text-wago-danger">Confirm signing out every browser session.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className={`${secondaryButtonClass} w-full sm:w-auto`}
                type="button"
                onClick={() => setConfirmAll(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className={`${dangerButtonClass} w-full sm:w-auto`}
                type="button"
                onClick={onSignOutAll}
                disabled={busy}
              >
                <LogOut size={14} />
                {isSigningOutAll ? "Signing out all" : "Confirm sign out all"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex justify-end">
            <button
              className={`${dangerButtonClass} w-full sm:w-auto`}
              type="button"
              onClick={() => setConfirmAll(true)}
              disabled={busy}
            >
              <LogOut size={14} />
              Sign out all sessions
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
