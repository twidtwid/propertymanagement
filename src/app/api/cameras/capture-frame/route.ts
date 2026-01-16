// Capture frame from Nest WebRTC camera
// This page is used by Playwright to capture snapshots
// Authenticates with CRON_SECRET to avoid user session requirement

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  // Authenticate with cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cameraId = request.nextUrl.searchParams.get('cameraId')

  if (!cameraId) {
    return NextResponse.json({ error: 'cameraId required' }, { status: 400 })
  }

  // Verify camera exists
  const cameras = await query<{ id: string; name: string }>(
    `SELECT id, name FROM cameras WHERE id = $1`,
    [cameraId]
  )

  if (cameras.length === 0) {
    return NextResponse.json({ error: 'Camera not found' }, { status: 404 })
  }

  // Pass cron secret to the page for internal API calls
  const cronSecretForPage = cronSecret

  // Return HTML page that establishes WebRTC and captures frame
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Capture Frame - ${cameras[0].name}</title>
  <style>
    body { margin: 0; background: #000; }
    video { width: 1920px; height: 1080px; }
    canvas { display: none; }
    #status { color: #fff; padding: 20px; font-family: monospace; }
  </style>
</head>
<body>
  <div id="status">Initializing...</div>
  <video id="video" autoplay playsinline muted></video>
  <canvas id="canvas"></canvas>
  <script>
    const cameraId = '${cameraId}';

    async function captureSnapshot() {
      const video = document.getElementById('video');
      const canvas = document.getElementById('canvas');
      const status = document.getElementById('status');

      try {
        status.textContent = 'Creating WebRTC connection...';

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        // Nest requires data channel first, then audio, then video
        pc.createDataChannel('dataSendChannel');
        pc.addTransceiver('audio', { direction: 'recvonly' });
        pc.addTransceiver('video', { direction: 'recvonly' });

        // Handle incoming stream
        pc.ontrack = (event) => {
          console.log('Track received:', event.track.kind);
          if (event.streams[0]) {
            video.srcObject = event.streams[0];
            status.textContent = 'Stream connected, waiting for frames...';
          }
        };

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        status.textContent = 'Sending offer to server...';

        const response = await fetch(
          '/api/cameras/internal-stream?cameraId=' + cameraId + '&offer=' + encodeURIComponent(offer.sdp),
          {
            headers: {
              'Authorization': 'Bearer ${cronSecretForPage}'
            }
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error('Stream API error: ' + response.status + ' - ' + errorText);
        }

        const data = await response.json();

        // Fix SDP for Chrome compatibility
        const fixedSdp = data.answerSdp.replace(/a=sendrecv/g, 'a=sendonly');

        await pc.setRemoteDescription({ type: 'answer', sdp: fixedSdp });

        status.textContent = 'WebRTC connected, waiting for video...';

        // Wait for video to have actual frames
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for video')), 25000);

          const checkFrame = () => {
            if (video.readyState >= 2 && video.videoWidth > 0) {
              clearTimeout(timeout);
              // Wait a bit more for stable frame
              setTimeout(resolve, 2000);
            } else {
              setTimeout(checkFrame, 100);
            }
          };
          checkFrame();
        });

        status.textContent = 'Capturing frame...';

        // Capture frame to canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Convert to base64 JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

        // Clean up
        pc.close();

        status.textContent = 'Done - ' + video.videoWidth + 'x' + video.videoHeight;
        window.snapshotData = dataUrl;
        window.snapshotWidth = video.videoWidth;
        window.snapshotHeight = video.videoHeight;
        window.snapshotReady = true;

      } catch (error) {
        console.error('Capture error:', error);
        status.textContent = 'Error: ' + error.message;
        window.snapshotError = error.message;
        window.snapshotReady = true;
      }
    }

    // Start capture
    captureSnapshot();
  </script>
</body>
</html>
`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}
