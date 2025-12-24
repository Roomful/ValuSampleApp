"use client";

import { useValuAPI } from "@/Hooks/useValuApi.tsx";
import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

type TopBarProps = {
  isIFrame: boolean;
  route?: string; // only used in iframe mode
  onNavigate?: (path: string) => void; // only used in iframe mode
};

export default function TopBar({ isIFrame, route = "/console", onNavigate }: TopBarProps) {
  const [user, setUser] = useState({ name: "John Doe", role: "Developer" });
  const [userIcon, setUserIcon] = useState("");
  const valuApi = useValuAPI();

  useEffect(() => {
    if (!valuApi) return;

    const getUserInfo = async () => {
      const usersApi = await valuApi.getApi("users");
      const currentUser = await usersApi.run("current");

      if (currentUser) {
        const name = `${currentUser.firstName} ${currentUser.lastName}`;
        const role = currentUser.companyTitle;

        setUser({ name, role });

        const icon = await usersApi.run("get-icon", { userId: currentUser.id });
        setUserIcon(icon);
      }
    };

    if (valuApi.connected) {
      getUserInfo();
    }
  }, [valuApi]);

  const tabClass = (active: boolean) =>
    `px-4 py-2 font-medium transition-colors rounded ${
      active ? "bg-white/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
    }`;

  // iframe active tab detection
  const active = useMemo(() => {
    const r = route || "/console";
    return {
      console: r === "/" || r === "/console" || r.startsWith("/console/"),
      storage: r === "/storage" || r.startsWith("/storage/"),
      docs: r === "/documentation" || r.startsWith("/documentation/"),
    };
  }, [route]);

  const go = (path: string) => {
    if (onNavigate) onNavigate(path);
  };

  return (
    <header className="bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md">
      <div className="w-full px-4 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          {/* User info */}
          <div className="flex items-center space-x-2">
            <div className="h-10 w-10 flex items-center justify-center bg-gray-200 rounded-full overflow-hidden">
              {!userIcon ? (
                <span className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-600" />
              ) : (
                <img src={userIcon} alt="User Icon" className="h-full w-full object-cover" />
              )}
            </div>

            <div className="flex flex-col">
              <span className="font-semibold text-sm">{user.name}</span>
              <span className="text-xs opacity-75">{user.role}</span>
            </div>
          </div>

          {/* Tabs navigation */}
          <nav className="flex gap-1">
            {!isIFrame ? (
              <>
                <NavLink to="/console" className={({ isActive }) => tabClass(isActive)}>
                  Console
                </NavLink>
                <NavLink to="/storage" className={({ isActive }) => tabClass(isActive)}>
                  Storage
                </NavLink>
                <NavLink to="/documentation" className={({ isActive }) => tabClass(isActive)}>
                  Documentation
                </NavLink>
              </>
            ) : (
              <>
                <button type="button" className={tabClass(active.console)} onClick={() => go("/console")}>
                  Console
                </button>
                <button type="button" className={tabClass(active.storage)} onClick={() => go("/storage")}>
                  Storage
                </button>
                <button type="button" className={tabClass(active.docs)} onClick={() => go("/documentation")}>
                  Documentation
                </button>
              </>
            )}
          </nav>

          {/* App title */}
          <h1 className="text-xl font-bold">Valu iFrame Sample App</h1>
        </div>
      </div>
    </header>
  );
}
