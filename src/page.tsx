"use client";

import TopBar from "./components/TopBar";
import { Console } from "./components/Console";
import SampleApiCalls from "./components/SampleApiCalls";
import Footer from "./components/Footer";
import Documentation from "./components/Documentation";
import ApplicationStorage from "./components/ApplicationStorage";
import { useEffect, useMemo, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { useValuAPI } from "@/Hooks/useValuApi";
import { ValuApi } from "@arkeytyp/valu-api";

function normalizeRoute(route: any) {
  const r = typeof route === "string" ? route : "";
  if (!r || r === "/") return "/console"; // demo default
  return r.startsWith("/") ? r : `/${r}`;
}

export default function Home() {
  const isIFrame = useMemo(() => window.self !== window.top, []);
  const valuApi = useValuAPI();

  // iframe-only routing state
  const [route, setRoute] = useState("/console");


  // iFrame: Valu -> UI route updates
  useEffect(() => {
    if (!isIFrame) return;
    if (!valuApi) return;

    const handler = (r: string) => {
      const next = normalizeRoute(r);
      setRoute(next);
    };

    valuApi.addEventListener(ValuApi.ON_ROUTE, handler);

  }, [isIFrame, valuApi]);

  // iFrame: UI -> Valu route push
  const onNavigate = useCallback(
    (path: string) => {
      const next = normalizeRoute(path);
      setRoute(next); // instant UI response for demo
      valuApi?.pushRoute(next);
    },
    [valuApi]
  );

  // iFrame page rendering
  const renderIFramePage = () => {
    if (route.startsWith("/storage")) return <ApplicationStorage />;
    if (route.startsWith("/documentation")) return <Documentation />;
    return (
      <div>
        <Console />
        <SampleApiCalls />
      </div>
    );
  };

  // ✅ Standalone: React Router
  if (!isIFrame) {
    return (
      <BrowserRouter>
        <div className="flex flex-col min-h-screen">
          <TopBar isIFrame={false} />
          <main className="flex-grow w-full px-4 py-8">
            <div className="max-w-[1400px] mx-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/console" replace />} />
                <Route
                  path="/console"
                  element={
                    <div>
                      <Console />
                      <SampleApiCalls />
                    </div>
                  }
                />
                <Route path="/storage" element={<ApplicationStorage />} />
                <Route path="/documentation" element={<Documentation />} />
              </Routes>
            </div>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    );
  }

  // ✅ iFrame: Valu-driven routing (no React Router)
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar isIFrame={true} route={route} onNavigate={onNavigate} />
      <main className="flex-grow w-full px-4 py-8">
        <div className="max-w-[1400px] mx-auto">{renderIFramePage()}</div>
      </main>
      <Footer />
    </div>
  );
}
