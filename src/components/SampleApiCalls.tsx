"use client"

import {Button} from "@/components/ui/button"
import {useValuAPI} from "@/Hooks/useValuApi.tsx";
import {useEffect} from "react";
import {Intent} from "@arkeytyp/valu-api";

export default function SampleApiCalls() {

  const valuApi = useValuAPI();

  useEffect(() => {

    if (!valuApi)
      return;

  }, [valuApi]);


  const OpenCurrentUserChat = async () => {
    const usersApi = await valuApi.getApi('users')
    const currentUser = await usersApi.run('current');
    if(!currentUser) {
      console.error('Something went wrong');
      return;
    }

    const intent = new Intent('textchat', 'open-channel', {userId:currentUser.id});
    await valuApi?.sendIntent(intent);
  }

  const OpenVideoChat = async () => {
    const intent = new Intent('videochat');
    await valuApi?.sendIntent(intent);
  }

  return (
    <div className="bg-gray-100 p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Sample API Calls</h2>
      <div className="grid grid-cols-2 gap-4">
        <Button disabled={!valuApi?.connected} onClick={OpenCurrentUserChat}>Open User Chat</Button>
        <Button disabled={!valuApi?.connected} onClick={OpenVideoChat}>Open Video Chat</Button>
      </div>
    </div>
  )
}

