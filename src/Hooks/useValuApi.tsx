import { useEffect, useState } from "react";
import { ValuApi } from "@arkeytyp/valu-api";

declare global {
    interface GlobalThis {
        valuApi?: ValuApi;
    }
}

export const useValuAPI = (): ValuApi | null => {
    const [valuApi, setValuApi] = useState<ValuApi | null>(null);

    useEffect(() => {
        // use dot notation and cast to any for globalThis
        let api = (globalThis as any).valuApi as ValuApi | undefined;
        if (!api) {
            api = (globalThis as any).valuApi = new ValuApi();
        }

        if (api.connected) {
            setValuApi(api);
        } else {
            api.addEventListener(ValuApi.API_READY, () => {
                setValuApi(api!);
            });
        }
    }, []);

    return valuApi;
};
