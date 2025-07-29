import { UserCircle } from "lucide-react"
import {useValuAPI} from "@/Hooks/useValuApi.tsx";
import {useEffect, useState} from "react";

export default function TopBar() {
  // Mock user data
  const [user, setUser] = useState({ name: "John Doe", role: "Developer" })

  const valuApi = useValuAPI();

  useEffect(() => {

    if (!valuApi)
      return;

    const getUserInfo = async () => {

      const usersApi = await valuApi.getApi('users')
      const currentUser = await usersApi.run('current');

      console.log(currentUser);


      const name = `${currentUser.firstName} ${currentUser.lastName}`;
      const role = currentUser.companyTitle;

      setUser({name, role});

    };

    if(valuApi.connected) {
      getUserInfo();
    }

  }, [valuApi]);


  return (
    <header className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">Valu iFrame Sample App</h1>
        <div className="flex items-center space-x-2">
          <UserCircle className="h-10 w-10" />
          <div className="flex flex-col">
            <span className="font-semibold">{user.name}</span>
            <span className="text-xs opacity-75">{user.role}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

