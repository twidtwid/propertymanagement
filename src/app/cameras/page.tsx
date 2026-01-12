export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { Video, AlertTriangle } from 'lucide-react'
import { getUser } from '@/lib/auth'
import { getCamerasGroupedByProperty } from '@/lib/actions'
import { CameraGrid } from '@/components/cameras/camera-grid'

export default async function CamerasPage() {
  const user = await getUser()

  if (!user) {
    return <div>Not authenticated</div>
  }

  // Barbara (bookkeeper) blocked
  if (user.role === 'bookkeeper') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Camera access is not available for your account.</p>
        </div>
      </div>
    )
  }

  const camerasGrouped = await getCamerasGroupedByProperty(user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8" />
            Cameras
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor all cameras across your properties
          </p>
        </div>
      </div>

      <Suspense fallback={<div>Loading cameras...</div>}>
        <CameraGrid camerasGrouped={camerasGrouped} />
      </Suspense>
    </div>
  )
}
