'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Camera, MapPin, AlertCircle } from 'lucide-react'

interface CameraFullscreenViewerProps {
  camera: {
    id: string
    name: string
    location: string | null
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CameraFullscreenViewer({ camera, open, onOpenChange }: CameraFullscreenViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    if (!open) {
      // Clean up when dialog closes
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
      }
      return
    }

    let mounted = true

    async function initStream() {
      try {
        setLoading(true)
        setError(null)

        // Create WebRTC peer connection
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        })
        pcRef.current = pc

        // Google Nest requires data channel FIRST, then audio, then video
        // Reference: https://developers.google.com/nest/device-access/traits/device/camera-live-stream
        pc.createDataChannel('dataSendChannel')
        pc.addTransceiver('audio', { direction: 'recvonly' })
        pc.addTransceiver('video', { direction: 'recvonly' })

        // Handle incoming stream
        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0]
            if (mounted) {
              setLoading(false)
            }
          }
        }

        // Create offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        // Send offer to server and get answer
        const response = await fetch(
          `/api/cameras/${camera.id}/stream?offer=${encodeURIComponent(offer.sdp || '')}`,
          { method: 'GET' }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to get stream')
        }

        const data = await response.json()

        // Fix Nest's answer SDP for Chrome 143+ compatibility
        // Nest returns a=sendrecv, but Chrome requires a=sendonly when offer is recvonly (RFC 3264)
        // Reference: https://github.com/home-assistant/core/issues/158153
        const fixedSdp = data.answerSdp.replace(/a=sendrecv/g, 'a=sendonly')

        // Set remote description (answer from Nest)
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: fixedSdp,
        })

        console.log('WebRTC stream connected')
      } catch (err) {
        console.error('Stream error:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load stream')
          setLoading(false)
        }
      }
    }

    initStream()

    return () => {
      mounted = false
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
      }
    }
  }, [camera.id, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {camera.name}
            {camera.location && (
              <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {camera.location}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-center">
                <Camera className="h-12 w-12 mx-auto mb-4 animate-pulse" />
                <p>Connecting to camera...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <p className="text-lg mb-2">Unable to connect</p>
                <p className="text-sm text-gray-400">{error}</p>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
            style={{ display: loading || error ? 'none' : 'block' }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
