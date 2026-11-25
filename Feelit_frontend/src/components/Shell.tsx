import { useEffect } from "react";
import { Compass, House, Luggage, MessageCircleHeart } from "lucide-react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { cx } from "@/lib/format";
import { Logo } from "./Logo";

const NAV = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/plan", label: "Plan", icon: MessageCircleHeart },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/trips", label: "Trips", icon: Luggage },
];

/** Page frame: a top bar (with the nav from tablet width up), a floating dock on phones, the night-map backdrop behind. */
/**
 * On touch screens, hide the bottom dock while the keyboard is open (a text field has focus),
 * so it never covers what you are typing. Adds `typing` to <html>; styles live in index.css.
 */
function useTypingMode() {
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ||
      (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(el.type));
    const touch = window.matchMedia("(pointer: coarse)");
    const update = (event: FocusEvent) => document.documentElement.classList.toggle("typing", touch.matches && event.type === "focusin" && isField(event.target));
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
}

export function Shell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const fullBleed = pathname === "/plan";
  useTypingMode();

  return (
    <div className="min-h-screen">
      <div className="aurora" aria-hidden><span /><span /></div>

      <header className="no-print sticky top-0 z-30 border-b border-white/[0.06] bg-night/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
          <Link to="/" aria-label="Feel It home" className="transition hover:opacity-90"><Logo /></Link>
          <nav className="hidden items-center gap-0.5 md:flex lg:gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx("relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition lg:px-4", isActive ? "text-snow" : "text-mist hover:text-snow")}>
                {({ isActive }) => (
                  <>
                    <Icon className={cx("h-4 w-4", isActive && "text-saffron")} />
                    {label}
                    {isActive && <span className="absolute inset-x-4 -bottom-[13px] h-0.5 rounded-full bg-saffron" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user && pathname !== "/plan" && <Link to="/plan" className="btn btn-primary hidden !py-2 lg:inline-flex"><MessageCircleHeart className="h-4 w-4" />Plan a trip</Link>}
            <ProfileButton name={user?.name} />
          </div>
        </div>
      </header>

      <main className={cx(!fullBleed && "pb-12 pt-4 lg:pt-8")}>
        <Outlet />
      </main>

      {!fullBleed && (
        <footer className="dock-pad no-print page pb-28 pt-6 text-xs text-mist/70 md:pb-10">
          <div className="flex flex-col gap-3 border-t border-white/5 pt-6 md:flex-row md:items-center md:justify-between">
            <Logo />
            <p className="max-w-xl leading-relaxed">
              AI estimates from live data — confirm prices before booking. Weather by <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> ·
              Maps © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors ·
              Places by <a className="underline" href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · Photos from Wikimedia Commons and <a className="underline" href="https://unsplash.com/?utm_source=feel_it&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>
            </p>
          </div>
        </footer>
      )}

      <nav aria-label="Main" className="dock no-print fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-4 rounded-3xl border border-white/10 bg-deep/90 p-1.5 shadow-lift backdrop-blur-2xl md:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx("flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition active:scale-95", isActive ? "bg-white/10 text-saffron" : "text-mist")}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function ProfileButton({ name }: { name?: string }) {
  if (!name) return <Link to="/auth" className="btn btn-primary !px-4 !py-2 text-xs">Sign in</Link>;
  return (
    <NavLink to="/profile" aria-label="Your profile" className={({ isActive }) => cx("flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-saffron to-rani font-display text-lg font-semibold text-night ring-2 transition", isActive ? "ring-snow" : "ring-transparent hover:ring-white/40")}>
      {name[0].toUpperCase()}
    </NavLink>
  );
}

/** Wraps the pages that need an account. */
export function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="page py-10"><div className="skeleton h-64" /></div>;
  return user ? <Outlet /> : <Navigate to="/auth" replace state={{ from: location.pathname }} />;
}

/** A simple centred message for empty and error states. */
export function Notice({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="page py-20 text-center">
      <h1 className="text-4xl">{title}</h1>
      {children && <p className="mx-auto mt-3 max-w-md text-mist">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

