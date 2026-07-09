import type {NextAuthConfig} from "next-auth";

export const authConfig = {
    pages:{
        signIn: '/login'
    },
    callbacks:{
        authorized({auth, request:{nextUrl}}){
            const isLoggedIn = !!auth?.user;
            const isProtected = nextUrl.pathname.startsWith('/dashboard');
            if(!isLoggedIn && isProtected)    return false;
            return true;
            
        }
    },
    providers:[],

} satisfies NextAuthConfig;