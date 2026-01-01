"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Menu, User, Settings, LogOut, Check, AlertTriangle, Info, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"

interface AuthUser {
  id: string
  email: string
  full_name: string | null
  role: "owner" | "bookkeeper"
}

interface Alert {
  id: string
  alert_type: string
  title: string
  message: string | null
  severity: "info" | "warning" | "critical"
  related_table: string | null
  related_id: string | null
  is_read: boolean
  created_at: string
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  // Fetch current user
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me")
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        }
      } catch (error) {
        console.error("Failed to fetch user:", error)
      }
    }
    fetchUser()
  }, [])

  // Fetch alerts
  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch("/api/alerts?limit=10&includeRead=true")
        if (res.ok) {
          const data = await res.json()
          setAlerts(data.alerts)
          setUnreadCount(data.unreadCount)
        }
      } catch (error) {
        console.error("Failed to fetch alerts:", error)
      }
    }
    fetchAlerts()

    // Refresh every 60 seconds
    const interval = setInterval(fetchAlerts, 60000)
    return () => clearInterval(interval)
  }, [])

  // Mark alerts as read when dropdown opens
  useEffect(() => {
    if (notificationsOpen && alerts.some(a => !a.is_read)) {
      const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id)
      fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertIds: unreadIds, action: "read" }),
      }).then(() => {
        setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
        setUnreadCount(0)
      })
    }
  }, [notificationsOpen, alerts])

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "DELETE" })
      router.push("/auth/login")
      router.refresh()
    } catch (error) {
      console.error("Failed to sign out:", error)
    }
  }

  const dismissAlert = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertIds: [alertId], action: "dismiss" }),
      })
      setAlerts(prev => prev.filter(a => a.id !== alertId))
    } catch (error) {
      console.error("Failed to dismiss alert:", error)
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const userInitials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).join("").toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?"

  const displayName = user?.full_name || user?.email?.split("@")[0] || "User"

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        onClick={onMenuClick}
      >
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center">
          {/* Page title will be added by individual pages */}
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <span className="sr-only">View notifications</span>
                <Bell className="h-6 w-6" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex justify-between items-center">
                <span>Notifications</span>
                {alerts.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {alerts.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No notifications
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-0 ${
                        !alert.is_read ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{alert.title}</p>
                          {alert.message && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {alert.message}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => dismissAlert(alert.id, e)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Separator */}
          <div
            className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200"
            aria-hidden="true"
          />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-x-3 p-1.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:flex lg:items-center">
                  <span
                    className="text-base font-medium leading-6 text-gray-900"
                    aria-hidden="true"
                  >
                    {displayName}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
