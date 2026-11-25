import { useState, type InputHTMLAttributes } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cx } from "@/lib/format";
import { PASSWORD_HINT, passwordProblem } from "@/lib/password";

/** A password box with a show/hide button. */
export function PasswordInput({ label, className, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative block">
        <input {...props} type={shown ? "text" : "password"} maxLength={72} className={cx("input !py-3 pr-12", className)} />
        <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? "Hide password" : "Show password"} className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-mist hover:text-snow">
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

export interface NewPassword {
  password: string;
  confirm: string;
}

/** True when the new password follows the rules and both boxes match. */
export const newPasswordReady = ({ password, confirm }: NewPassword) => !passwordProblem(password) && password === confirm;

/** "New password" and "Type it again", with live feedback on the rules and on whether they match. */
export function NewPasswordFields({ value, onChange, label = "Password" }: { value: NewPassword; onChange: (value: NewPassword) => void; label?: string }) {
  const problem = value.password ? passwordProblem(value.password) : null;
  const mismatch = value.confirm.length > 0 && value.confirm !== value.password;
  return (
    <div className="space-y-4">
      <div>
        <PasswordInput label={label} value={value.password} onChange={(e) => onChange({ ...value, password: e.target.value })} autoComplete="new-password" placeholder="Create a password" required />
        <p className={cx("mt-1.5 text-xs", problem ? "text-coral" : value.password ? "text-peacock" : "text-mist")}>
          {problem ?? (value.password ? <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" />Strong enough</span> : PASSWORD_HINT)}
        </p>
      </div>
      <div>
        <PasswordInput label="Type it again" value={value.confirm} onChange={(e) => onChange({ ...value, confirm: e.target.value })} autoComplete="new-password" placeholder="Re-enter the password" required />
        {value.confirm && (
          <p className={cx("mt-1.5 text-xs", mismatch ? "text-coral" : "text-peacock")}>
            {mismatch ? "The passwords don't match." : <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" />Passwords match</span>}
          </p>
        )}
      </div>
    </div>
  );
}
