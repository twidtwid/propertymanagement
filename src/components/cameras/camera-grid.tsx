'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Video, MapPin, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { CameraFullscreenViewer } from './camera-fullscreen-viewer'
import { CAMERA_PROVIDER_LABELS, CAMERA_STATUS_LABELS } from '@/types/database'
import type { CamerasByProperty } from '@/lib/actions/cameras'

interface CameraGridProps {
  camerasGrouped: CamerasByProperty[]
}

export function CameraGrid({ camerasGrouped }: CameraGridProps) {
  const [selectedCamera, setSelectedCamera] = useState<{
    id: string
    name: string
    location: string | null
    provider: string
  } | null>(null)

  // Track refresh counter for nest_legacy cameras (force image reload)
  const [refreshCounter, setRefreshCounter] = useState(0)

  // Auto-refresh snapshots every 10 minutes for nest_legacy cameras
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshCounter((prev) => prev + 1)
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(interval)
  }, [])

  if (camerasGrouped.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No cameras configured yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Cameras will appear here once configured
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-8">
        {camerasGrouped.map(({ property, cameras }) => (
          <div key={property.id} className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">{property.name}</h2>
              <span className="text-muted-foreground">
                {property.city}, {property.state}
              </span>
              <Badge variant="outline" className="ml-2">
                {cameras.length} {cameras.length === 1 ? 'camera' : 'cameras'}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cameras.map((camera) => (
                <Card
                  key={camera.id}
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() =>
                    setSelectedCamera({
                      id: camera.id,
                      name: camera.name,
                      location: camera.location,
                      provider: camera.provider,
                    })
                  }
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{camera.name}</span>
                      {camera.status === 'online' ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-gray-400" />
                      )}
                    </CardTitle>
                    {camera.location && (
                      <p className="text-sm text-muted-foreground">{camera.location}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Snapshot preview or placeholder */}
                    <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-md flex flex-col items-center justify-center overflow-hidden relative">
                      {camera.provider === 'nest_legacy' ? (
                        <>
                          {/* Live snapshot from API endpoint - auto-refreshes via refreshCounter */}
                          <img
                            src={`/api/cameras/${camera.id}/snapshot?t=${refreshCounter}`}
                            alt={camera.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            <span>Live</span>
                          </div>
                        </>
                      ) : camera.snapshot_url ? (
                        <>
                          <img
                            src={camera.snapshot_url}
                            alt={camera.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {camera.snapshot_captured_at &&
                              new Date(camera.snapshot_captured_at).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                          </div>
                        </>
                      ) : (
                        <>
                          <Video className="h-12 w-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-300">Click to view live</p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {CAMERA_PROVIDER_LABELS[camera.provider]}
                      </span>
                      <Badge
                        variant={camera.status === 'online' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {CAMERA_STATUS_LABELS[camera.status]}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedCamera && (
        <CameraFullscreenViewer
          camera={selectedCamera}
          open={!!selectedCamera}
          onOpenChange={(open) => !open && setSelectedCamera(null)}
        />
      )}
    </>
  )
}
