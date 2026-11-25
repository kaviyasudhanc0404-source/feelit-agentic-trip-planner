import { useState, type FormEvent } from "react";
import { ArrowRight, CloudSun, Globe, Wand2 } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { NewPasswordFields, newPasswordReady, PasswordInput } from "@/components/PasswordFields";
import { PostcardStream } from "@/components/Postcards";
import { useAuth } from "@/context/auth";
import { cx } from "@/lib/format";

const PERKS = [
  { icon: Wand2, text: "An AI agent that plans like a human expert" },
  { icon: Globe, text: "Live trending spots, prices and festivals" },
  { icon: CloudSun, text: "Weather-aware days you can edit any time" },
];

export default function Auth() {
  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const location = useLocation();
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });

  if (user) return <Navigate to={location.state?.from ?? "/"} replace />;

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value }),
    className: "input !py-3",
    required: true,
  });

  /** Runs any sign-in method with the same busy state and error handling. */
  const run = async (method: () => Promise<void>) => {
    setBusy(true);
    try {
      await method();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isNew && !newPasswordReady(form)) return toast.error(form.password === form.confirm ? "Choose a stronger password." : "The passwords don't match.");
    run(() => (isNew ? signUp(form.name.trim(), form.email.trim(), form.password) : signIn(form.email.trim(), form.password)));
  };
  /** Switching between sign in and sign up clears the passwords, never the email. */
  const switchTo = (create: boolean) => {
    setIsNew(create);
    setForm({ ...form, password: "", confirm: "" });
  };

  return (
    <div className="relative grid min-h-[100svh] grid-cols-1 overflow-x-clip lg:grid-cols-[1.1fr_1fr]">
      <div className="aurora" aria-hidden><span /><span /></div>
      <PostcardWall />

      <main className="relative flex min-w-0 items-center justify-center p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-10">
        <div className="w-full max-w-md animate-rise">
          <Link to="/" className="inline-block"><Logo /></Link>
          <PostcardStream direction="horizontal" className="-mx-5 mt-6 sm:-mx-10 lg:hidden" />
          <h1 className="mt-10 text-4xl sm:text-5xl">{isNew ? <>Start your <span className="accent">journey</span></> : <>Welcome <span className="accent">back</span></>}</h1>
          <p className="mt-2 text-mist">{isNew ? "Free forever. Your trips, saved and editable anywhere." : "Pick up right where your travels left off."}</p>

          <div className="glass mt-8 p-6 sm:p-7">
            <div className="mb-6 grid grid-cols-2 border-b border-white/10">
              {(["Sign in", "Create account"] as const).map((label, i) => (
                <button key={label} type="button" onClick={() => switchTo(i === 1)} className={cx("-mb-px border-b-2 pb-3 text-sm font-bold transition", isNew === (i === 1) ? "border-saffron text-snow" : "border-transparent text-mist hover:text-snow")}>{label}</button>
              ))}
            </div>

            <button type="button" onClick={() => run(signInWithGoogle)} disabled={busy} className="btn w-full bg-snow !py-3 text-night hover:bg-white">
              <GoogleMark /> Continue with Google
            </button>
            <p className="my-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mist before:h-px before:flex-1 before:bg-white/10 after:h-px after:flex-1 after:bg-white/10">or with email</p>

            <form onSubmit={submit} className="space-y-4">
              {isNew && <label className="block"><span className="label">Your name</span><input {...field("name")} minLength={2} maxLength={60} autoComplete="name" placeholder="Priya Sharma" /></label>}
              <label className="block"><span className="label">Email</span><input {...field("email")} type="email" autoComplete="email" placeholder="you@example.com" /></label>
              {isNew ? (
                <NewPasswordFields value={form} onChange={(next) => setForm({ ...form, ...next })} />
              ) : (
                <PasswordInput label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" placeholder="Your password" required />
              )}
              <button type="submit" disabled={busy || (isNew && !newPasswordReady(form))} className="btn btn-primary w-full !py-3">{busy ? "Please wait…" : isNew ? "Create my account" : "Sign in"}<ArrowRight className="h-4 w-4" /></button>
            </form>
          </div>

          <ul className="mt-8 space-y-3">
            {PERKS.map(({ icon: Icon, text }) => <li key={text} className="flex items-center gap-3 text-sm text-mist"><Icon className="h-4 w-4 text-saffron" />{text}</li>)}
          </ul>
        </div>
      </main>
    </div>
  );
}

/** Live trending destinations drifting past like postcards on a wall. */
function PostcardWall() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-white/5 lg:block">
      <PostcardStream className="absolute inset-0 p-6" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night via-night/80 to-transparent p-10 pt-32">
        <p className="eyebrow">Trending in India now</p>
        <p className="mt-2 max-w-md font-display text-4xl leading-tight">Every trip starts with a <span className="accent">feeling</span>.</p>
      </div>
    </aside>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
