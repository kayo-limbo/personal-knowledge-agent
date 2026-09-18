"use client";
import UserDropdown from "./UserDropdown";
import SearchBar from "./SearchBar"
interface Props {
    user:{
        name?: string | null;
        email?: string | null;
        role?: string;
    }
}

export default function Header({user}:Props){
    return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background/80 px-3 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center w-full justify-end gap-3">
        {user.role !== "GUEST" && <div className="hidden md:block"><SearchBar /></div>}
        <UserDropdown user={user} />
      </div>
    </header>
  );
}
