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
    <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b bg-background/80 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          个人知识智能助手
        </h1>

        <p className="text-sm text-muted-foreground">
          AI 工作空间
        </p>
      </div>

      <div className="flex items-center gap-6">
        <SearchBar />
        <UserDropdown user={user} />
      </div>
    </header>
  );
}
