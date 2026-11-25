import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";
import { NewPasswordFields, newPasswordReady, PasswordInput, type NewPassword } from "./PasswordFields";

type Step = "idle" | "verify" | "new";
const EMPTY: NewPassword = { password: "", confirm: "" };

/**
 * Change the password: first confirm the current one (checked by the server), and only then
 * choose a new one twice. Google-only accounts skip straight to setting a first password.
 */
export function PasswordSection() {
  const { user, changePassword } = useAuth();
  const hasPassword = user!.has_password;
  const [step, setStep] = useState<Step>("idle");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("idle");
    setCurrent("");
    setNext(EMPTY);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = (event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await api.checkPassword(current);
      setStep("new");
    });
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!newPasswordReady(next)) return;
    run(async () => {
      await changePassword(hasPassword ? current : null, next.password);
      toast.success(hasPassword ? "Password changed. Other devices were signed out." : "Password set. You can now also sign in with your email.");
      reset();
    });
  };

  return (
    <div className="border-t border-white/10 pt-5">
      <span className="label">Password</span>
      {step === "idle" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-mist">
            {hasPassword ? <><ShieldCheck className="h-4 w-4 text-peacock" />Signed in with email and password</> : <><KeyRound className="h-4 w-4 text-saffron" />You sign in with Google. Set a password to also sign in with your email.</>}
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => setStep(hasPassword ? "verify" : "new")}>
            <KeyRound className="h-4 w-4" />{hasPassword ? "Change password" : "Set a password"}
          </button>
        </div>
      )}

      {step === "verify" && (
        <form onSubmit={verify} className="space-y-4 animate-rise">
          <PasswordInput label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" placeholder="Enter your current password" autoFocus required />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy || !current}>{busy ? "Checking…" : "Continue"}</button>
            <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      {step === "new" && (
        <form onSubmit={save} className="space-y-4 animate-rise">
          {hasPassword && <p className="flex items-center gap-2 text-sm text-peacock"><ShieldCheck className="h-4 w-4" />Current password confirmed. Now choose a new one.</p>}
          <NewPasswordFields label="New password" value={next} onChange={setNext} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy || !newPasswordReady(next)}>{busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}</button>
            <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
