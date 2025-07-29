import {useEffect, useRef, useState} from "react";
import {ValuApi} from "@arkeytyp/valu-api";



export const useValuAPI = (): ValuApi | null => {
    const [valuApi, setValuApi] = useState(null);

    useEffect(() => {

        let valuApi;
        if( typeof globalThis['valuApi'] !== 'undefined' )  {
            valuApi = globalThis['valuApi'];
        } else {
            valuApi = globalThis['valuApi'] =  new ValuApi();
        }

        if(valuApi.connected) {
            setValuApi(valuApi);
        } else {
            valuApi.addEventListener(ValuApi.API_READY, async (e) => {
                setValuApi(valuApi);
            });
        }
    }, []);
    return valuApi;
};
