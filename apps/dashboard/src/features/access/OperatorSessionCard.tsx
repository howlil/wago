import { LogOut } from "lucide-react";
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
      <div className="min-w-0">
        <h2 className={sectionTitleClass}>Dashboard session</h2>
        <p className={sectionDescriptionClass}>
          Browser access uses the admin password and remains separate from machine API credentials.
        </p>
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
