"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Home,
  Building2,
  Car,
  Users,
  CreditCard,
  Shield,
  Wrench,
  FileText,
  BarChart3,
  Settings,
  X,
} from "lucide-react"
import { GlobalSearch } from "@/components/shared/global-search"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Vehicles", href: "/vehicles", icon: Car },
  { name: "Vendors", href: "/vendors", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Insurance", href: "/insurance", icon: Shield },
  { name: "Maintenance", href: "/maintenance", icon: Wrench },
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="fixed inset-y-0 left-0 z-50 w-full max-w-xs overflow-y-auto bg-white p-0 sm:max-w-sm">
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-semibold">PropManager</span>
          </Link>
          <button
            type="button"
            className="-m-2.5 p-2.5"
            onClick={onClose}
          >
            <span className="sr-only">Close sidebar</span>
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 pt-4">
          <GlobalSearch />
        </div>
        <nav className="flex flex-1 flex-col px-6 pb-4 pt-4">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onClose}
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
                      onClick={onClose}
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
      </DialogContent>
    </Dialog>
  )
}
