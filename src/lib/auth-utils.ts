export const roleRoutes: Record<string, string[]> = {
    ADMIN:["/dashboard", "/dashboard/admin"],
    USER:["/dashboard"],
    GUEST:["/dashboard/chat"]
};

export function canAccess(role:string, pathname:string): boolean{
    const allowed=roleRoutes[role] ?? [];
    return allowed.some((route) => pathname.startsWith(route));
}