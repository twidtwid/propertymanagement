import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, ArrowRight } from "lucide-react"
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils"
import type { Bill, PropertyTax } from "@/types/database"

interface UpcomingPaymentsProps {
  bills: Bill[]
  taxes: PropertyTax[]
}

export function UpcomingPayments({ bills, taxes }: UpcomingPaymentsProps) {
  // Combine and sort by due date
  const allPayments = [
    ...bills.map((b) => ({
      id: b.id,
      type: "bill" as const,
      description: b.description || b.bill_type,
      property: b.property?.name,
      amount: b.amount,
      due_date: b.due_date,
      status: b.status,
    })),
    ...taxes.map((t) => ({
      id: t.id,
      type: "tax" as const,
      description: `Property Tax - ${t.jurisdiction} (Q${t.installment})`,
      property: t.property?.name,
      amount: t.amount,
      due_date: t.due_date,
      status: t.status,
    })),
  ]
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Upcoming Payments
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/payments">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {allPayments.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No upcoming payments
          </p>
        ) : (
          <div className="space-y-4">
            {allPayments.map((payment) => {
              const days = daysUntil(payment.due_date)
              const isOverdue = days < 0
              const isUrgent = days >= 0 && days <= 7

              return (
                <div
                  key={`${payment.type}-${payment.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium truncate">
                      {payment.description}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {payment.property}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <p className="text-base font-semibold">
                        {formatCurrency(Number(payment.amount))}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(payment.due_date)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        isOverdue
                          ? "destructive"
                          : isUrgent
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {isOverdue
                        ? `${Math.abs(days)}d overdue`
                        : days === 0
                        ? "Today"
                        : `${days}d`}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
