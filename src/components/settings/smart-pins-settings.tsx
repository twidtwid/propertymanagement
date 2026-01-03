"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/**
 * Smart Pins management settings
 * Allows resetting all smart pins and clearing dismissals
 */
export function SmartPinsSettings() {
  const [isResetting, setIsResetting] = useState(false)
  const { toast } = useToast()

  const handleReset = async () => {
    setIsResetting(true)

    try {
      const response = await fetch("/api/smart-pins/reset", {
        method: "POST",
      })

      if (response.ok) {
        toast({
          title: "Smart pins reset successfully",
          description: "All dismissals cleared and smart pins re-synced.",
          action: <CheckCircle className="h-4 w-4 text-green-600" />,
        })
      } else {
        throw new Error("Failed to reset")
      }
    } catch (error) {
      console.error("Reset error:", error)
      toast({
        title: "Reset failed",
        description: "Could not reset smart pins. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Smart Pins
        </CardTitle>
        <CardDescription>
          Manage system-generated pins that highlight items needing attention
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">What are Smart Pins?</h4>
          <p className="text-sm text-muted-foreground">
            Smart pins are automatically generated based on urgency and attention needs:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
            <li>Overdue bills or upcoming due dates</li>
            <li>Unconfirmed check payments (&gt;14 days)</li>
            <li>Urgent or high-priority tickets</li>
            <li>BuildingLink messages requiring action</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">
            You can dismiss smart pins by clicking the orange star. They won't reappear unless conditions change.
          </p>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Reset Smart Pins</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Use this to restore all dismissed smart pins and re-sync based on current system state.
            This is useful if you've dismissed something and want to see it again.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isResetting}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isResetting ? 'animate-spin' : ''}`} />
                Reset All Smart Pins
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all smart pins?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Clear all dismissed smart pins (you'll see them again)</li>
                    <li>Re-sync smart pins based on current system state</li>
                    <li>Not affect user pins (yellow stars)</li>
                  </ul>
                  <p className="mt-3">
                    This action cannot be undone. Dismissed items will reappear if they still meet smart pin criteria.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  Reset Smart Pins
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
