import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  CreditCard,
  Building2,
  Shield,
  Car,
  Wrench,
  ArrowRight,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { UpcomingItem } from "@/types/database"

interface UpcomingWeekProps {
  items: UpcomingItem[]
}

const iconMap = {
  bill: CreditCard,
  tax: Building2,
  insurance: Shield,
  car: Car,
  ticket: Wrench,
}

export function UpcomingWeek({ items }: UpcomingWeekProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Coming Up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Nothing due in the next 7 days
          </p>
        </CardContent>
      </Card>
    )
  }

  const getDaysBadgeText = (daysUntil: number): string => {
    if (daysUntil === 0) return "Today"
    if (daysUntil === 1) return "Tomorrow"
    return `${daysUntil}d`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Coming Up
          <Badge variant="outline" className="ml-2">
            {items.length}
          </Badge>
        </CardTitle>
        <Link
          href="/calendar"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View Calendar
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.slice(0, 5).map((item) => {
          const Icon = iconMap[item.icon]

          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.amount !== null && (
                  <span className="text-sm font-medium">
                    {formatCurrency(item.amount)}
                  </span>
                )}
                <Badge
                  variant={item.daysUntil <= 2 ? "warning" : "secondary"}
                  className="text-xs"
                >
                  {getDaysBadgeText(item.daysUntil)}
                </Badge>
              </div>
            </Link>
          )
        })}
        {items.length > 5 && (
          <Link
            href="/calendar"
            className="block text-center text-sm text-muted-foreground hover:text-foreground py-2"
          >
            +{items.length - 5} more items
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
