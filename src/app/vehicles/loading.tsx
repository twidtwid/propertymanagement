import { LoadingPropertyCards } from "@/components/shared/loading-cards"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>
        <Skeleton className="h-11 w-36 rounded-lg" />
      </div>
      <LoadingPropertyCards />
    </div>
  )
}
