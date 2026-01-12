"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Home,
  Building2,
  Building,
  Car,
  Users,
  CreditCard,
  CalendarDays,
  Shield,
  Wrench,
  FileText,
  BarChart3,
  Settings,
  Landmark,
  Video,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GlobalSearch } from "@/components/shared/global-search"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Cameras", href: "/cameras", icon: Video },
  { name: "BuildingLink", href: "/buildinglink", icon: Building },
  { name: "Vehicles", href: "/vehicles", icon: Car },
  { name: "Vendors", href: "/vendors", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Taxes", href: "/payments/taxes", icon: Landmark },
  { name: "Insurance", href: "/insurance", icon: Shield },
  { name: "Tickets", href: "/tickets", icon: Wrench },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Reports", href: "/reports", icon: BarChart3 },
]

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  // Wait for client-side hydration to complete
  useEffect(() => {
    setMounted(true)
  }, [])

  // Helper to check if path is active
  const isActive = (href: string) => {
    if (!mounted || !pathname) return false
    return pathname === href || (href !== "/" && pathname.startsWith(href + "/"))
  }

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-white px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold">PropManager</span>
          </Link>
        </div>

        <GlobalSearch />

        <ScrollArea className="flex-1">
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-7 list-none">
              <li>
                <ul className="-mx-2 space-y-1 list-none">
                  {navigation.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            "group flex gap-x-3 rounded-xl p-3 text-base font-medium leading-6 transition-colors"
                          )}
                        >
                          <item.icon
                            className={cn(
                              active
                                ? "text-primary"
                                : "text-muted-foreground group-hover:text-foreground",
                              "h-6 w-6 shrink-0"
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
              <li className="mt-auto">
                <ul className="-mx-2 space-y-1 list-none">
                  {secondaryNavigation.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            "group flex gap-x-3 rounded-xl p-3 text-base font-medium leading-6 transition-colors"
                          )}
                        >
                          <item.icon
                            className="h-6 w-6 shrink-0"
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
            </ul>
          </nav>
        </ScrollArea>
      </div>
    </div>
  )
}
