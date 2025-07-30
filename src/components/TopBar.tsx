import {useValuAPI} from "@/Hooks/useValuApi.tsx";
import {useEffect, useState} from "react";

export default function TopBar() {
  // Mock user data
  const [user, setUser] = useState({ name: "John Doe", role: "Developer" })

  const [userIcon, setUserIcon] = useState("");

  const valuApi = useValuAPI();

  useEffect(() => {

    if (!valuApi)
      return;

    const getUserInfo = async () => {

      const usersApi = await valuApi.getApi('users')
      const currentUser = await usersApi.run('current');



      if(currentUser) {
        const name = `${currentUser.firstName} ${currentUser.lastName}`;
        const role = currentUser.companyTitle;

        setUser({name, role});

        const icon = await usersApi.run('get-icon', {userId:currentUser.id});
        setUserIcon(icon);
      }
    };

    if(valuApi.connected) {
      getUserInfo();
    }

  }, [valuApi]);


  return (
    <header className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">

        <div className="flex items-center space-x-2">
          <div className="h-10 w-10 flex items-center justify-center bg-gray-200 rounded-full overflow-hidden">
            {!userIcon ? (
              <span className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-600"></span>
            ) : (
              <img src={userIcon} alt="User Icon" className="h-full w-full object-cover"/>
            )}
          </div>

          <div className="flex flex-col">
            <span className="font-semibold">{user.name}</span>
            <span className="text-xs opacity-75">{user.role}</span>
          </div>
        </div>
        <h1 className="text-2xl pr-16 font-bold">Valu iFrame Sample App</h1>
      </div>
    </header>
  )
}

