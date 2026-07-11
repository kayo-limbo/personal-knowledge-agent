"use client"

import {signIn} from "next-auth/react"
import {useState} from "react"
import {useRouter} from "next/navigation"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const router = useRouter()

    async function handleSubmit(e: React.FormEvent){
        e.preventDefault()
        const res= await signIn("credentials", {
            email,
            password,
            redirect: false,
        })
        if (res?.error) {
            setError("Invalid email or password")
        } else {
            router.push("/dashboard")
        }

        
    }
    return (
            <form onSubmit={handleSubmit}>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" />
                <input 
                type="password"
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                />
                {error&& <p style={{color:"red"}}>{error}</p>}
                <button type="submit">登录</button>
            </form>
        )
}
