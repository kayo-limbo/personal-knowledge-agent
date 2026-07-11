"use client";


import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

interface Props{
    user:{
        name?:string |null;
        email?:string |null;
        role?:string;
    }
}

export default function UserDropdown({user}:Props){
  function handleLogout(){
    signOut();
  }
    return(
       <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
        {(user.name ?? user.email ?? "U")
          .charAt(0)
          .toUpperCase()}
      </div>

      <div className="leading-tight">
        <div className="text-sm font-medium">
          {user.name ?? "Unknown"}
        </div>

        <div className="text-xs text-gray-500">
          {user.role}
        </div>
      </div>


      <button
        onClick={handleLogout}
        className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-black"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
    )
}