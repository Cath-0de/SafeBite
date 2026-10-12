// Live camera view on the Scan page: reads the first product barcode it sees,
// passes the number to onDetect, and turns the camera off.
import { useEffect, useRef, useState } from 'react'
import { BarcodeDetector } from 'barcode-detector/ponyfill'

// The barcode types printed on food packaging.
const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })

export default function CameraScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [cameraError, setError] = useState('')
  // Browsers only allow the camera on https or localhost, where mediaDevices exists.
  const error = navigator.mediaDevices ? cameraError : 'The camera only works on a secure (https) page. Type the number below instead.'

  useEffect(() => {
    let stream: MediaStream | undefined
    let timer: number | undefined
    let stopped = false

    // Look for a barcode in the current frame a few times a second until one is found.
    async function scan() {
      if (stopped || !video.current) return
      try {
        const [found] = await detector.detect(video.current)
        if (found && !stopped) {
          stopped = true
          onDetect(found.rawValue)
          return
        }
      } catch (err) {
        // A frame can fail while the video is still starting; just try the next one.
        console.debug(err)
      }
      timer = window.setTimeout(scan, 250)
    }

    // The back camera on phones; whatever camera there is on laptops.
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (s) => {
        stream = s
        if (stopped || !video.current) return
        video.current.srcObject = s
        await video.current.play()
        scan()
      })
      .catch((err: unknown) => {
        if (stopped) return
        const name = err instanceof DOMException ? err.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it in your browser settings, or type the number below.'
            : name === 'NotFoundError'
              ? 'No camera found. Type the barcode number below instead.'
              : "Couldn't start the camera. Type the barcode number below instead.",
        )
      })

    // Turn the camera off when the scanner closes or a barcode is found.
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetect])

  return (
    <div className="scanner">
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <>
          <video ref={video} muted playsInline aria-label="Camera view" />
          <p className="muted">Point the camera at the barcode and hold it steady.</p>
        </>
      )}
      <button type="button" onClick={onClose}>Close camera</button>
    </div>
  )
}
