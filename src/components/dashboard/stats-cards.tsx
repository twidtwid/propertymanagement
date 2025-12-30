import { Card, CardContent } from "@/components/ui/card"
import { Building2, Car, CreditCard, AlertTriangle } from "lucide-react"

interface StatsCardsProps {
  stats: {
    properties: number
    vehicles: number
    upcomingBills: number
    urgentTasks: number
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      name: "Properties",
      value: stats.properties,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      name: "Vehicles",
      value: stats.vehicles,
      icon: Car,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      name: "Upcoming Bills",
      value: stats.upcomingBills,
      icon: CreditCard,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      name: "Urgent Tasks",
      value: stats.urgentTasks,
      icon: AlertTriangle,
      color: stats.urgentTasks > 0 ? "text-red-600" : "text-gray-600",
      bgColor: stats.urgentTasks > 0 ? "bg-red-50" : "bg-gray-50",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.name}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-xl p-3 ${card.bgColor}`}>
                <card.icon className={`h-7 w-7 ${card.color}`} />
              </div>
              <div>
                <p className="text-base text-muted-foreground">{card.name}</p>
                <p className="text-3xl font-semibold">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
