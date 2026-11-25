import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Church, MessageCircleHeart, Mountain, PawPrint, Tent, Waves } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Grid, SectionTitle, SpotCard } from "@/components/cards";
import { PlaceInput } from "@/components/PlaceInput";
import { useConversation } from "@/context/conversation";
import { api } from "@/lib/api";
import { locate } from "@/lib/location";
import { HOUR } from "@/components/Postcards";
import { Trending } from "./Home";

const MOODS = [
  { icon: Mountain, label: "Hill stations", prompt: "Suggest the best hill stations in India to visit this month and why" },
  { icon: Waves, label: "Beaches", prompt: "Suggest beautiful, less crowded beaches in India for this month" },
  { icon: Building2, label: "Heritage", prompt: "Suggest heritage towns in India worth a trip this month" },
  { icon: PawPrint, label: "Wildlife", prompt: "Which wildlife sanctuaries in India are best to visit this month?" },
  { icon: Church, label: "Spiritual", prompt: "Suggest peaceful spiritual places in India to visit this month" },
  { icon: Tent, label: "Adventure", prompt: "Suggest adventure trips in India for this month: treks, rafting, camping" },
];

/** Search any place in India, see what's around you, and browse what's trending. */
export default function Explore() {
  const navigate = useNavigate();
  const { send } = useConversation();
  const [params, setParams] = useSearchParams();
  const [coords, setCoords] = useState<{ lat: number; lon: number }>();

  const findMe = () =>
    locate().then(setCoords).catch((error: Error) => {
      toast.error(error.message);
      setParams({});
    });

  useEffect(() => {
    if (params.get("near")) findMe();
    // Run once when the page opens with ?near=1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <section className="page pt-4 sm:pt-10">
        <p className="eyebrow !text-peacock">Explore India</p>
        <h1 className="mt-3 max-w-4xl text-5xl leading-[0.95] sm:text-7xl">Find places that <span className="accent">move you</span></h1>
        <div className="mt-8 max-w-3xl">
          <PlaceInput large placeholder="Search any town, city or hill station" onPick={(place) => navigate(`/explore/${encodeURIComponent(place.label)}`)} onLocate={findMe} />
        </div>
        <p className="rule mt-10">Or ask the agent by mood</p>
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] bg-white/[0.07] sm:grid-cols-3 lg:grid-cols-6">
          {MOODS.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              onClick={() => {
                send(prompt);
                navigate("/plan");
              }}
              className="group flex flex-col items-start gap-6 bg-night p-5 text-left transition hover:bg-[#0e1426]"
            >
              <Icon className="h-6 w-6 text-saffron transition group-hover:-translate-y-1" />
              <span className="font-display text-xl">{label}</span>
            </button>
          ))}
        </div>
      </section>
      {coords && <NearMe lat={coords.lat} lon={coords.lon} />}
      <Trending />
    </>
  );
}

function NearMe({ lat, lon }: { lat: number; lon: number }) {
  const navigate = useNavigate();
  const { send } = useConversation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["nearby", lat.toFixed(2), lon.toFixed(2)],
    queryFn: () => api.nearby(lat, lon),
    staleTime: HOUR,
    retry: false,
  });

  const planHere = () => {
    send("Plan a one-day trip near me");
    navigate("/plan");
  };

  return (
    <section className="page mt-14">
      <SectionTitle
        eyebrow="Around you"
        aside={data && <button className="btn btn-primary" onClick={planHere}><MessageCircleHeart className="h-4 w-4" />Plan a day trip here</button>}
      >
        {data ? <>Worth visiting near <span className="accent">{data.here.name}</span></> : "Looking around you…"}
      </SectionTitle>
      {error ? <p className="glass p-5 text-sm text-coral">{error.message}</p> : (
        <Grid loading={isLoading}>
          {data?.places.slice(0, 8).map((spot, i) => <SpotCard key={i} spot={spot} near={data.here.label} />)}
        </Grid>
      )}
    </section>
  );
}
