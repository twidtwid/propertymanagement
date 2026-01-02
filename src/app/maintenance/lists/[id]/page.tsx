export const dynamic = 'force-dynamic'

import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Building2, User, Plus } from "lucide-react"
import { getSharedTaskListWithItems } from "@/lib/actions"
import { formatDate } from "@/lib/utils"
import { TaskItemList } from "@/components/maintenance/task-item-list"

interface PageProps {
  params: { id: string }
}

export default async function SharedTaskListPage({ params }: PageProps) {
  const list = await getSharedTaskListWithItems(params.id)

  if (!list) {
    notFound()
  }

  const completedCount = list.items?.filter((item) => item.is_completed).length || 0
  const totalCount = list.items?.length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/maintenance">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{list.title}</h1>
          <div className="flex items-center gap-4 mt-1 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {list.property?.name}
            </span>
            {list.assigned_to && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {list.assigned_to}
              </span>
            )}
          </div>
        </div>
        <Badge variant={list.is_active ? "success" : "secondary"}>
          {list.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tasks</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {completedCount} of {totalCount} completed
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {totalCount === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No tasks in this list yet
            </p>
          ) : (
            <TaskItemList listId={list.id} items={list.items || []} />
          )}
        </CardContent>
      </Card>

      {list.assigned_contact && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{list.assigned_contact}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
