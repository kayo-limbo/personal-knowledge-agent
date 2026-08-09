import {authConfig} from './auth.config';
import NextAuth from "next-auth";

export const proxy = NextAuth(authConfig).auth;

export const config = {
    matcher:["/dashboard/:path*", "/api/chat/:path*", "/api/knowledge/:path*", "/api/prompts/:path*"]
};
