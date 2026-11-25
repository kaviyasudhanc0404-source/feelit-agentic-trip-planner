import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { RequireAuth, Shell } from "@/components/Shell";
import { AuthProvider } from "@/context/auth";
import { BuilderProvider } from "@/context/builder";
import { ConversationProvider } from "@/context/conversation";
import Home from "@/pages/Home";

// Everything except the landing page loads on demand, so the first visit stays fast.
const Plan = lazy(() => import("@/pages/Plan"));
const Explore = lazy(() => import("@/pages/Explore"));
const Guide = lazy(() => import("@/pages/Guide"));
const Trips = lazy(() => import("@/pages/Trips"));
const Trip = lazy(() => import("@/pages/Trip"));
const Auth = lazy(() => import("@/pages/Auth"));
const Profile = lazy(() => import("@/pages/Profile"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ConversationProvider>
            <BuilderProvider>
              <Suspense fallback={<div className="page py-10"><div className="skeleton h-64" /></div>}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route element={<Shell />}>
                    <Route index element={<Home />} />
                    <Route path="/plan" element={<Plan />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/explore/:place" element={<Guide />} />
                    <Route path="/share/:shareId" element={<Trip />} />
                    <Route element={<RequireAuth />}>
                      <Route path="/trips" element={<Trips />} />
                      <Route path="/trips/:tripId" element={<Trip />} />
                      <Route path="/profile" element={<Profile />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
              <Toaster position="top-center" theme="dark" toastOptions={{ className: "!rounded-2xl !border !border-white/10 !bg-deep !font-sans !text-snow" }} />
            </BuilderProvider>
          </ConversationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
