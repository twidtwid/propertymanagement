"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Loader2, CheckCircle, XCircle } from "lucide-react"

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get("token")

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const verifyAttempted = useRef(false)

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setMessage("Invalid or missing login link.")
      return
    }

    // Prevent double-call in React Strict Mode
    if (verifyAttempted.current) return
    verifyAttempted.current = true

    async function verifyToken() {
      try {
        const response = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        })

        const data = await response.json()

        if (response.ok) {
          setStatus("success")
          setMessage("Login successful! Redirecting...")
          setTimeout(() => {
            // Use window.location for full page reload to pick up new cookie
            window.location.href = "/"
          }, 1500)
        } else {
          setStatus("error")
          setMessage(data.error || "Login link is invalid or expired.")
        }
      } catch {
        setStatus("error")
        setMessage("An error occurred. Please try again.")
      }
    }

    verifyToken()
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Property Management</CardTitle>
          <CardDescription>Verifying your login link</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === "loading" && (
            <div className="py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Verifying your login link...</p>
            </div>
          )}

          {status === "success" && (
            <div className="py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-green-600 dark:text-green-400 font-medium">{message}</p>
            </div>
          )}

          {status === "error" && (
            <div className="py-8">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400 mb-4">{message}</p>
              <Button onClick={() => router.push("/auth/login")}>
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
