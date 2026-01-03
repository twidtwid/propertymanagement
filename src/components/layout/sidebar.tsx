"use client"

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
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GlobalSearch } from "@/components/shared/global-search"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "BuildingLink", href: "/buildinglink", icon: Building },
  { name: "Vehicles", href: "/vehicles", icon: Car },
  { name: "Vendors", href: "/vendors", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
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
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          pathname === item.href || pathname.startsWith(item.href + "/")
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          "group flex gap-x-3 rounded-xl p-3 text-base font-medium leading-6 transition-colors"
                        )}
                      >
                        <item.icon
                          className={cn(
                            pathname === item.href || pathname.startsWith(item.href + "/")
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground",
                            "h-6 w-6 shrink-0"
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto">
                <ul role="list" className="-mx-2 space-y-1">
                  {secondaryNavigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          pathname === item.href
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
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </ScrollArea>
      </div>
    </div>
  )
}
