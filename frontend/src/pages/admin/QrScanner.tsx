import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

function getBarcodeDetector(): BarcodeDetectorConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector ?? null;
}

interface QrScannerProps {
  onScan: (value: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

/**
 * Camera-based QR scanning via the native BarcodeDetector API (no library).
 * The caller must feature-detect support before rendering this component.
 */
export default function QrScanner({ onScan, onError, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let detector: BarcodeDetectorInstance | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onError("Camera access is not available in this browser — use manual entry.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        const Ctor = getBarcodeDetector();
        detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
        setStarting(false);

        const scanFrame = async () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (video && detector && video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              const value = codes[0]?.rawValue;
              if (value) {
                stopStream();
                onScan(value.trim());
                return;
              }
            } catch {
              // Single-frame detection errors are ignored; the loop continues.
            }
          }
          timer = setTimeout(() => void scanFrame(), 400);
        };
        void scanFrame();
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          onError("Camera permission was denied — allow camera access or use manual entry.");
        } else if (name === "NotFoundError") {
          onError("No camera found on this device — use manual entry.");
        } else {
          onError("Could not start the camera — use manual entry.");
        }
      }
    }

    function stopStream() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    void start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="qr-scanner">
      {starting ? <p className="muted">Starting camera…</p> : null}
      <video ref={videoRef} className="qr-scanner-video" muted playsInline />
      <button type="button" className="btn btn-ghost btn-sm qr-scanner-close" onClick={onClose}>
        Cancel scan
      </button>
    </div>
  );
}

/* ---------- photo capture (works over plain HTTP) ---------- */

const MAX_IMAGE_DIMENSION = 1200;

interface PhotoQrCaptureProps {
  /** Called with the decoded QR text (ticket number or opaque qr token). */
  onScan: (value: string) => void;
  onError: (message: string) => void;
  busy?: boolean;
}

/**
 * Decode-a-photo fallback for environments where getUserMedia is blocked
 * (non-secure contexts): opens the native camera via a capture file input
 * and decodes the QR with jsQR — pure JS, no native APIs required.
 */
export function PhotoQrCapture({ onScan, onError, busy = false }: PhotoQrCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [decoding, setDecoding] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setDecoding(true);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      try {
        // Downscale very large photos for a faster decode.
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          onError("Could not process the photo — type the ticket number instead.");
          return;
        }
        ctx.drawImage(bitmap, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);

        const code = jsQR(imageData.data, width, height, { inversionAttempts: "attemptBoth" });
        const value = code?.data?.trim();
        if (value) {
          onScan(value);
        } else {
          onError("Couldn't read the QR — try a sharper photo or type the ticket number.");
        }
      } finally {
        bitmap.close();
      }
    } catch {
      onError("That file couldn't be read as an image — try another photo.");
    } finally {
      setDecoding(false);
      // Allow picking the same file again.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="qr-photo-input"
        aria-label="Photograph a QR code to scan"
        disabled={busy || decoding}
        onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy || decoding}
        onClick={() => inputRef.current?.click()}
      >
        {decoding ? "Decoding…" : "Scan with camera (take a photo)"}
      </button>
    </>
  );
}
