import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useValuAPI } from "@/Hooks/useValuApi";

export function ValuRouterBridge() {
  const valuApi = useValuAPI();
  //const navigate = useNavigate();
  const { pathname } = useLocation();

  // Iframe -> Host
  useEffect(() => {
    if (!valuApi) return;
    valuApi.pushRoute(pathname);
  }, [valuApi, pathname]);

  return null;
}
