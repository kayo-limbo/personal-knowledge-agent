"use client";
import { usePathname } from "next/navigation";
import UserDropdown from "./UserDropdown";

interface Props {
    user:{
        name?: string | null;
        email?: string | null;
        role?: string;
    }
}

export default function Header({user}:Props){
  const pathname = usePathname();
  const breadcrumb =
    pathname
      .split("/")
      .filter(Boolean)
      .map((item) => 
        item.replace("-", " ")
      );
    return(
         <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-8 backdrop-blur">
        <div>
        <h2 className="text-xl font-semibold">
          Dashboard
        </h2>
        <div className="mt-1 flex gap-2 text-xs text-gray-500">
          {
            breadcrumb.map((item,index)=>(
              <span key={index}>
                {item}
                {
                  index !== breadcrumb.length-1
                  &&
                  " / "
                }
              </span>
            ))
          }
        </div>
      </div>
      <UserDropdown user={user}/>
    </header>
    )
}