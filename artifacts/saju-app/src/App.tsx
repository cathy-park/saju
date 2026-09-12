import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/authContext";
import Home from "@/pages/Home";
import MyProfile from "@/pages/MyProfile";
import PeopleList from "@/pages/PeopleList";
import AddPerson from "@/pages/AddPerson";
import EditPerson from "@/pages/EditPerson";
import PersonDetail from "@/pages/PersonDetail";
import Compatibility from "@/pages/Compatibility";
import ZiweiHome from "@/pages/ZiweiHome";
import ZiweiTopicSelect from "@/pages/ZiweiTopicSelect";
import ZiweiSpouseReport from "@/pages/ZiweiSpouseReport";
import ZiweiWealthReport from "@/pages/ZiweiWealthReport";
import ZiweiCareerReport from "@/pages/ZiweiCareerReport";
import ZiweiNatureReport from "@/pages/ZiweiNatureReport";
import ZiweiRomanceReport from "@/pages/ZiweiRomanceReport";
import ZiweiMarriageTimingReport from "@/pages/ZiweiMarriageTimingReport";
import ZiweiComprehensiveReport from "@/pages/ZiweiComprehensiveReport";
import WesternPersonality from "@/pages/WesternPersonality";
import WesternRelationship from "@/pages/WesternRelationship";
import WesternTransit from "@/pages/WesternTransit";
import WesternSynastry from "@/pages/WesternSynastry";
import WesternOverview from "@/pages/WesternOverview";
import WesternRelationshipOverview from "@/pages/WesternRelationshipOverview";
import WesternLocationSettings from "@/pages/WesternLocationSettings";
import { WesternPersonalRedirect, WesternRelationshipEntry, WesternSynastryRedirect } from "@/pages/WesternRedirects";
import AuthCallback from "@/pages/AuthCallback";
import NotFound from "@/pages/not-found";
import { Home as HomeIcon, User, Users } from "lucide-react";
import { AuthBar } from "@/components/AuthBar";
import { useState, useEffect } from "react";

const queryClient = new QueryClient();

function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { href: "/",       label: "홈",    icon: HomeIcon, exact: true  },
    { href: "/saju",   label: "나의 흐름", icon: User,    exact: false },
    { href: "/people", label: "상대",  icon: Users,   exact: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto max-w-lg">
        <div className="flex h-14 items-center gap-1 px-2">
          {tabs.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact
              ? location === "/"
              : location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href} className="flex-1">
                <button
                  type="button"
                  className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg py-1 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className={`rounded-lg p-2 transition-colors ${isActive ? "bg-primary/10" : ""}`}>
                    <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.25px]" : "stroke-[1.75px]"}`} />
                  </div>
                  <span className={`text-xs leading-none ${isActive ? "font-bold" : "font-semibold"}`}>
                    {label}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function AppHeader() {
  return (
    <div className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        {/* Brand wordmark — 클릭 시 홈으로 이동 */}
        <Link href="/" className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 12C3 12 5.5 7 8.5 7C11.5 7 12.5 17 15.5 17C18.5 17 21 12 21 12"
              stroke="hsl(12,72%,50%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-sans text-lg font-bold tracking-tight text-foreground">
            나의 흐름
          </span>
        </Link>
        <AuthBar />
      </div>
    </div>
  );
}

function SyncedApp() {
  const { dbSynced } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [location] = useLocation();

  // Increment key when sync completes to trigger child re-reads
  useEffect(() => {
    if (dbSynced) setRefreshKey((k) => k + 1);
  }, [dbSynced]);

  // Always scroll to top on route change.
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return (
    <>
      <AppHeader />
      <main className="pb-14 pt-14" key={refreshKey}>
        <Switch>
          <Route path="/auth/callback"           component={AuthCallback} />
          <Route path="/"                        component={Home} />
          <Route path="/saju"                    component={MyProfile} />
          <Route path="/people"                  component={PeopleList} />
          <Route path="/people/add"              component={AddPerson} />
          <Route path="/people/:id/edit"         component={EditPerson} />
          <Route path="/people/:id"              component={PersonDetail} />
          <Route path="/compatibility"           component={Compatibility} />
          <Route path="/compatibility/:personId" component={Compatibility} />
          <Route path="/ziwei"                   component={ZiweiHome} />
          <Route path="/ziwei/:personId"         component={ZiweiTopicSelect} />
          <Route path="/ziwei/:personId/spouse"  component={ZiweiSpouseReport} />
          <Route path="/ziwei/:personId/wealth"  component={ZiweiWealthReport} />
          <Route path="/ziwei/:personId/career"  component={ZiweiCareerReport} />
          <Route path="/ziwei/:personId/nature"  component={ZiweiNatureReport} />
          <Route path="/ziwei/:personId/romance" component={ZiweiRomanceReport} />
          <Route path="/ziwei/:personId/marriageTiming" component={ZiweiMarriageTimingReport} />
          <Route path="/ziwei/:personId/overview" component={ZiweiComprehensiveReport} />
          <Route path="/western/:personId/synastry/:otherPersonId/details" component={WesternSynastry} />
          <Route path="/western/:personId/synastry/:otherPersonId/overview" component={WesternRelationshipOverview} />
          <Route path="/western/:personId/synastry/:otherPersonId" component={WesternSynastryRedirect} />
          <Route path="/western/:personId/overview" component={WesternOverview} />
          <Route path="/western/:personId/personality" component={WesternPersonality} />
          <Route path="/western/:personId/transit" component={WesternTransit} />
          <Route path="/western/:personId/romance" component={WesternRelationship} />
          <Route path="/western/:personId/location" component={WesternLocationSettings} />
          <Route path="/western/:personId/relationship" component={WesternRelationshipEntry} />
          <Route path="/western/:personId" component={WesternPersonalRedirect} />
          <Route                                 component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <SyncedApp />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
