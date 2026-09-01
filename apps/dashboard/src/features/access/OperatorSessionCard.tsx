import { LogOut, ShieldCheck } from "lucide-react";
import {
  cardBodyClass,
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
  return (
    <section className={cardBodyClass}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wago-brand-soft text-wago-brand-strong">
          <ShieldCheck size={16} />
        </div>
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>Dashboard session</h2>
          <p className={sectionDescriptionClass}>
            Browser access is protected by the admin password and is separate from machine API credentials.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-wago-line pt-3 sm:flex-row sm:justify-end">
        <button
          className={`${secondaryButtonClass} w-full sm:w-auto`}
          type="button"
          onClick={onSignOutAll}
          disabled={isSigningOut || isSigningOutAll}
        >
          <LogOut size={14} />
          {isSigningOutAll ? "Signing out all" : "Sign out all sessions"}
        </button>
        <button
          className={`${secondaryButtonClass} w-full sm:w-auto`}
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut || isSigningOutAll}
        >
          <LogOut size={14} />
          {isSigningOut ? "Signing out" : "Sign out"}
        </button>
      </div>
    </section>
  );
}
