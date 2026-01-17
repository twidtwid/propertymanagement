import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, Check } from "lucide-react"
import { formatCurrency, formatDate, daysSince } from "@/lib/utils"
import type { Bill } from "@/types/database"

interface ConfirmationAlertsProps {
  bills: Bill[]
}

export function ConfirmationAlerts({ bills }: ConfirmationAlertsProps) {
  if (bills.length === 0) return null

  return (
    <Card className="border-amber-500/30 bg-amber-500/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-5 w-5" />
          Checks Needing Confirmation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-base text-amber-700 dark:text-amber-400 mb-4">
          The following payments were sent but haven&apos;t been confirmed as cashed.
          Bank of America checks should be verified.
        </p>
        <div className="space-y-3">
          {bills.map((bill) => {
            const days = daysSince(bill.payment_date!)
            return (
              <div
                key={bill.id}
                className="flex items-center justify-between p-3 rounded-xl border border-amber-500/20 bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium truncate">
                    {bill.description || bill.bill_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {bill.property?.name} - Sent {formatDate(bill.payment_date!)}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <p className="text-base font-semibold">
                      {formatCurrency(Number(bill.amount))}
                    </p>
                    <Badge variant="destructive">
                      {days} days waiting
                    </Badge>
                  </div>
                  <Button size="sm" variant="outline">
                    <Check className="h-4 w-4 mr-1" />
                    Confirm
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
