import { lazy, Suspense, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Copy, Lock, MessageCircle, Palette, Pencil, Printer, Share2, Sparkles, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Notice } from "@/components/Shell";
import { TripContext, type TripCtx } from "@/components/trip/kit";
import { TripAssistant, useTripAssistant } from "@/components/TripAssistant";
import { TripEditor } from "@/components/TripEditor";
import { useWeather } from "@/components/Weather";
import { api } from "@/lib/api";
import { downloadCalendar } from "@/lib/calendar";
import { cx, whatsappLink } from "@/lib/format";
import { useDeleteTrip } from "@/lib/trips";
import { useStoredState } from "@/lib/storage";
import { paletteFor, paletteVars, pickView, VIEWS, type ViewId } from "@/lib/tripStyle";
import type { Trip } from "@/lib/types";

/** Each layout is its own chunk, so a trip only downloads the one it shows. */
const LAYOUTS: Record<ViewId, ComponentType<{ actions: ReactNode }>> = {
  cinematic: lazy(() => import("@/components/trip/Cinematic")),
  bento: lazy(() => import("@/components/trip/Bento")),
  map: lazy(() => import("@/components/trip/MapExplorer")),
  scrapbook: lazy(() => import("@/components/trip/Scrapbook")),
  luxury: lazy(() => import("@/components/trip/Luxury")),
  aurora: lazy(() => import("@/components/trip/NightTimeline")),
};

/** A planned trip. Also renders the read-only public view at /share/:shareId. */
export default function TripPage() {
  const { tripId, shareId } = useParams();
  const { data: trip, isLoading, error } = useQuery({
    queryKey: shareId ? ["shared", shareId] : ["trip", tripId],
    queryFn: () => (shareId ? api.sharedTrip(shareId) : api.trip(tripId!)),
    retry: false,
  });

  if (isLoading) return <Loading />;
  if (error || !trip) {
    return <Notice title="This trip isn't available" action={<Link to="/plan" className="btn btn-primary">Plan a new trip</Link>}>{error?.message}</Notice>;
  }
  return <TripView key={trip.id} trip={trip} owner={!shareId} />;
}

function Loading() {
  return (
    <div className="page space-y-5 py-6">
      <div className="skeleton h-[22rem]" />
      <div className="grid gap-5 lg:grid-cols-[1fr_23rem]"><div className="skeleton h-96" /><div className="skeleton h-72" /></div>
    </div>
  );
}

/** The layout this viewer picked for a trip (remembered on this device), else the recommended one. */
function useLayoutChoice(trip: Trip) {
  const recommended = useMemo(() => pickView(trip), [trip]);
  const [chosen, choose] = useStoredState<ViewId | null>(`feelit_view_${trip.id}`, null);
  return { id: chosen && chosen in LAYOUTS ? chosen : recommended.id, recommended, choose };
}

function TripView({ trip, owner }: { trip: Trip; owner: boolean }) {
  const [params, setParams] = useSearchParams();
  const editing = owner && params.get("edit") === "1";
  const setEditing = (on: boolean) => setParams(on ? { edit: "1" } : {}, { replace: true });
  const [assistantOpen, setAssistantOpen] = useState(false);
  const assistant = useTripAssistant(trip);
  const { data: weather } = useWeather(trip.destination);
  const [dayIndex, setDayIndex] = useState(0);
  const layout = useLayoutChoice(trip);
  const view = VIEWS.find((v) => v.id === layout.id)!;
  const Layout = LAYOUTS[layout.id];
  const palette = useMemo(() => paletteFor(trip), [trip]);

  const context: TripCtx = {
    trip,
    owner,
    weather,
    near: trip.destination.label,
    ask: (text) => {
      setAssistantOpen(true);
      assistant.send(text);
    },
    dayIndex: Math.min(dayIndex, trip.days.length - 1),
    setDayIndex,
    light: Boolean(view.light),
  };

  const actions = (
    <ActionBar trip={trip} owner={owner} editing={editing} onEdit={() => setEditing(!editing)} onAsk={() => setAssistantOpen(true)}>
      <StylePicker current={layout.id} recommended={layout.recommended} onPick={layout.choose} />
    </ActionBar>
  );

  return (
    <>
      {editing ? (
        <div className="trip-theme page" style={paletteVars(palette, false)}>
          <p className="eyebrow">{trip.destination.label}</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{trip.title}</h1>
          <ActionBar trip={trip} owner={owner} editing onEdit={() => setEditing(false)} onAsk={() => setAssistantOpen(true)} />
          <div className="mt-6"><TripEditor trip={trip} onClose={() => setEditing(false)} /></div>
        </div>
      ) : (
        <TripContext value={context}>
          <div
            className={cx("trip-theme", layout.id === "luxury" && "paper", layout.id === "scrapbook" && "kraft", view.light && "-mt-4 pb-20 pt-4 lg:-mt-8 lg:pt-8")}
            style={paletteVars(palette, Boolean(view.light))}
          >
            <Suspense fallback={<Loading />}>
              <Layout key={layout.id} actions={actions} />
            </Suspense>
            {!owner && <div className="page mt-14 text-center"><Link to="/plan" className="btn btn-primary">Plan your own trip with Feel It</Link></div>}
          </div>
        </TripContext>
      )}

      {owner && !editing && !assistantOpen && (
        <button
          onClick={() => setAssistantOpen(true)}
          aria-label="Ask Feel It about this trip"
          className="no-print btn btn-primary dock-hide fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 h-14 w-14 !p-0 shadow-glow sm:h-auto sm:w-auto sm:!px-5 sm:!py-3 md:bottom-8 md:right-8"
        >
          <Sparkles className="h-5 w-5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Ask Feel It</span>
        </button>
      )}
      {assistantOpen && <TripAssistant assistant={assistant} onClose={() => setAssistantOpen(false)} />}
    </>
  );
}

/** "Explore styles": switch the layout; the recommended one is marked with the reason. */
function StylePicker({ current, recommended, onPick }: { current: ViewId; recommended: { id: ViewId; reason: string }; onPick: (id: ViewId) => void }) {
  const [open, setOpen] = useState(false);
  const label = VIEWS.find((v) => v.id === current)!.label;
  return (
    <div className="relative">
      <button className="btn btn-ghost shrink-0" onClick={() => setOpen(!open)} aria-expanded={open} title={`Style: ${label}`}>
        <Palette className="h-4 w-4" /><span className="hidden sm:inline">Style: </span>{label}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label="Close styles" onClick={() => setOpen(false)} />
          <div className="glass-strong absolute left-0 top-full z-50 mt-2 w-[min(23rem,calc(100vw-2rem))] p-2 text-snow animate-rise" role="menu">
            <p className="px-3 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-mist">Explore styles</p>
            {VIEWS.map(({ id, label: name, hint, icon: Icon }) => (
              <button
                key={id}
                role="menuitemradio"
                aria-checked={id === current}
                onClick={() => {
                  onPick(id);
                  setOpen(false);
                }}
                className={cx("flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition", id === current ? "bg-white/10" : "hover:bg-white/5")}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-saffron" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    {name}
                    {id === recommended.id && <span className="rounded-full bg-peacock/15 px-2 py-0.5 text-[10px] font-bold text-peacock">Picked for {recommended.reason}</span>}
                  </span>
                  <span className="block text-xs text-mist">{hint}</span>
                </span>
                {id === current && <Check className="mt-0.5 h-4 w-4 shrink-0 text-saffron" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ActionBar({ trip, owner, editing, onEdit, onAsk, children }: { trip: Trip; owner: boolean; editing: boolean; onEdit: () => void; onAsk: () => void; children?: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useDeleteTrip(() => navigate("/trips"));
  const share = useMutation({
    mutationFn: (isPublic: boolean) => api.shareTrip(trip.id, isPublic),
    onSuccess: (result) => queryClient.setQueryData(["trip", trip.id], { ...trip, ...result }),
    onError: (error: Error) => toast.error(error.message),
  });
  const link = trip.share_id ? `${window.location.origin}/share/${trip.share_id}` : "";

  return (
    <div className="no-print relative z-20 mt-5 space-y-3">
      <div className="flex items-center gap-2 sm:flex-wrap">
        {children}
        <div className="-mr-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-4 [scrollbar-width:none] sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
          {owner && (
            <>
              <button className={cx("btn", editing ? "btn-primary" : "btn-ghost")} onClick={onEdit}><Pencil className="h-4 w-4" />{editing ? "Close editor" : "Edit plan"}</button>
              {!editing && <button className="btn btn-ghost" onClick={onAsk}><Sparkles className="h-4 w-4 text-tintink" />Ask AI to change it</button>}
              <button className="btn btn-ghost" onClick={() => share.mutate(!trip.is_public)} disabled={share.isPending}>
                {trip.is_public ? <><Lock className="h-4 w-4" />Make private</> : <><Share2 className="h-4 w-4" />Share</>}
              </button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => downloadCalendar(trip)}><CalendarPlus className="h-4 w-4" />Calendar</button>
          <button className="btn btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / PDF</button>
          {owner && (
            <ConfirmButton className="btn btn-ghost ml-auto hover:text-coral" question="Delete this trip?" busy={remove.isPending} onConfirm={() => remove.mutate(trip.id)}>
              <Trash2 className="h-4 w-4" />Delete
            </ConfirmButton>
          )}
        </div>
      </div>
      {owner && trip.is_public && link && (
        <div className="panel flex flex-wrap items-center gap-2 p-3 animate-rise">
          <span className="eyebrow">Public link</span>
          <input readOnly value={link} className="input min-w-0 flex-1 !py-2 font-mono text-xs" onFocus={(e) => e.target.select()} />
          <button className="btn btn-ghost !py-2" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied."))}><Copy className="h-4 w-4" />Copy</button>
          <a className="btn btn-ghost !py-2" href={whatsappLink(`${trip.title} — my ${trip.destination.name} trip on Feel It: ${link}`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 text-peacock" />WhatsApp</a>
        </div>
      )}
    </div>
  );
}
