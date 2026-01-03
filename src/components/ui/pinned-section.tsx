import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Star, Zap, Info } from "lucide-react"

interface PinnedSectionProps {
  count: number
  title?: string
  variant?: 'smart' | 'user'
  children: React.ReactNode
  className?: string
}

const VARIANT_STYLES = {
  smart: {
    card: "border-orange-200 bg-orange-50/50 dark:bg-orange-950/10",
    title: "text-orange-700 dark:text-orange-400",
    badge: "bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    icon: "fill-orange-400 text-orange-400",
  },
  user: {
    card: "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10",
    title: "text-yellow-700 dark:text-yellow-400",
    badge: "bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    icon: "fill-yellow-400 text-yellow-400",
  },
}

/**
 * Accented card for displaying pinned items
 * - Smart variant (orange): System-generated pins based on urgency/attention
 * - User variant (yellow): Manually pinned by users
 */
export function PinnedSection({
  count,
  title = "Pinned Items",
  variant = 'user',
  children,
  className,
}: PinnedSectionProps) {
  if (count === 0) return null

  const styles = VARIANT_STYLES[variant]
  const Icon = variant === 'smart' ? Zap : Star

  const tooltipContent = variant === 'smart'
    ? "Smart Pins are automatically generated based on urgency and attention. Click the star to dismiss items you've already addressed."
    : "User Pins are manually pinned items that all users can see. Click the star to unpin."

  return (
    <Card className={`${styles.card} ${className || ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-sm font-medium ${styles.title} flex items-center gap-2`}>
          <Icon className={`h-4 w-4 ${styles.icon}`} />
          {title}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 opacity-60 hover:opacity-100 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{tooltipContent}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge variant="secondary" className={`ml-auto ${styles.badge}`}>
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  )
}
