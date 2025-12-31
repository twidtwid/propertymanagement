import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ReportCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    label: string
  }
  className?: string
}

export function ReportCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: ReportCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <p
                className={cn(
                  "text-sm font-medium",
                  trend.value >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value.toFixed(1)}% {trend.label}
              </p>
            )}
          </div>
          {icon && (
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
