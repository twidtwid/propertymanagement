import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, Car, DollarSign } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { DashboardStats } from "@/types/database"

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      name: "Properties",
      value: stats.properties.toString(),
      icon: Building2,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/15",
      href: "/properties",
    },
    {
      name: "Vehicles",
      value: stats.vehicles.toString(),
      icon: Car,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/15",
      href: "/vehicles",
    },
    {
      name: "Due 30 Days",
      value: formatCurrency(stats.due30Days),
      icon: DollarSign,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/15",
      href: "/payments",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.name} href={card.href}>
          <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.name}</p>
                  <p className="text-xl font-semibold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
