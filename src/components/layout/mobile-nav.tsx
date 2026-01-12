"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  Home,
  Building2,
  Building,
  Car,
  Users,
  CreditCard,
  Shield,
  Wrench,
  FileText,
  BarChart3,
  Settings,
  Landmark,
  Video,
} from "lucide-react"
import { GlobalSearch } from "@/components/shared/global-search"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
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

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export function MobileNav({ open, onClose }: MobileNavProps) {
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
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full max-w-xs p-0 sm:max-w-sm flex flex-col h-full">
        <div className="flex h-16 shrink-0 items-center px-6 border-b">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold">PropManager</span>
          </Link>
        </div>
        <div className="px-6 pt-4 shrink-0">
          <GlobalSearch />
        </div>
        <nav className="flex-1 overflow-y-auto px-6 pb-4 pt-4">
          <ul className="flex flex-col gap-y-7 min-h-full list-none">
            <li>
              <ul className="-mx-2 space-y-1 list-none">
                {navigation.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted",
                          "group flex gap-x-3 rounded-xl p-3 text-base font-medium leading-6 transition-colors touch-manipulation"
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
                        onClick={onClose}
                        className={cn(
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted",
                          "group flex gap-x-3 rounded-xl p-3 text-base font-medium leading-6 transition-colors touch-manipulation"
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
      </SheetContent>
    </Sheet>
  )
}
