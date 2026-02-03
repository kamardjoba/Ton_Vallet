/**
 * QR Code Scanner component
 * Scans QR codes for TON Connect DApp connections
 */

import { useEffect, useRef, useState } from 'react';
import { HapticFeedback } from '../utils/telegram';
import LoadingSpinner from './LoadingSpinner';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export default function QRScanner({ isOpen, onClose, onScan }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async () => {
    try {
      setError(null);
      setIsScanning(true);

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        // Start scanning for QR codes
        startQRDetection();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Failed to access camera: ' + (err.message || 'Unknown error'));
      }
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  };

  const startQRDetection = () => {
    // Use a simple QR code detection library or implement basic detection
    // For now, we'll use a canvas-based approach with jsQR library
    // But first, let's try a simpler approach with manual detection

    scanIntervalRef.current = window.setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Try to detect QR code using image data
          // For now, we'll use a library approach
          detectQRCode(canvas, context);
        }
      }
    }, 200); // Check every 200ms
  };

  const detectQRCode = async (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
    try {
      // Use dynamic import for QR code library
      const jsQR = (await import('jsqr')).default;
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        HapticFeedback.notification('success');
        stopScanning();
        onScan(code.data);
      }
    } catch (err) {
      // If jsQR is not available, log error
      console.error('QR detection error:', err);
      // Don't show error to user on every frame, only log
    }
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="qr-scanner-overlay" onClick={handleClose}>
      <div className="qr-scanner-content" onClick={(e) => e.stopPropagation()}>
        <div className="qr-scanner-header">
          <h2>Scan QR Code</h2>
          <button className="qr-scanner-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="qr-scanner-body">
          {error ? (
            <div className="qr-scanner-error">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
              <button
                className="retry-button"
                onClick={() => {
                  setError(null);
                  startScanning();
                }}
              >
                Try Again
              </button>
            </div>
          ) : hasPermission === false ? (
            <div className="qr-scanner-error">
              <div className="error-icon">📷</div>
              <p>Camera permission is required to scan QR codes.</p>
              <p className="error-hint">Please enable camera access in your browser settings and try again.</p>
            </div>
          ) : (
            <>
              <div className="qr-scanner-video-container">
                <video
                  ref={videoRef}
                  className="qr-scanner-video"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="qr-scanner-canvas" style={{ display: 'none' }} />
                <div className="qr-scanner-overlay-frame">
                  <div className="qr-scanner-frame" />
                </div>
              </div>
              {isScanning && (
                <div className="qr-scanner-hint">
                  <p>Point your camera at a QR code</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .qr-scanner-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3000;
          padding: 20px;
        }

        .qr-scanner-content {
          background: #1a1a1a;
          border-radius: 20px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .qr-scanner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #333;
        }

        .qr-scanner-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: white;
        }

        .qr-scanner-close {
          background: none;
          border: none;
          font-size: 32px;
          color: white;
          cursor: pointer;
          padding: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .qr-scanner-close:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .qr-scanner-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          min-height: 400px;
        }

        .qr-scanner-video-container {
          position: relative;
          width: 100%;
          max-width: 400px;
          aspect-ratio: 1;
          border-radius: 16px;
          overflow: hidden;
          background: #000;
        }

        .qr-scanner-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .qr-scanner-overlay-frame {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .qr-scanner-frame {
          width: 80%;
          height: 80%;
          border: 3px solid #667eea;
          border-radius: 16px;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
          animation: pulse-border 2s ease-in-out infinite;
        }

        @keyframes pulse-border {
          0%, 100% {
            border-color: #667eea;
            opacity: 1;
          }
          50% {
            border-color: #764ba2;
            opacity: 0.8;
          }
        }

        .qr-scanner-hint {
          margin-top: 20px;
          text-align: center;
          color: white;
        }

        .qr-scanner-hint p {
          margin: 0;
          font-size: 14px;
          opacity: 0.8;
        }

        .qr-scanner-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px 20px;
          color: white;
        }

        .error-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .qr-scanner-error p {
          margin: 8px 0;
          font-size: 16px;
          line-height: 1.5;
        }

        .error-hint {
          font-size: 14px;
          opacity: 0.7;
          margin-top: 12px;
        }

        .retry-button {
          margin-top: 24px;
          padding: 12px 24px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .retry-button:hover {
          background: #5568d3;
        }
      `}</style>
    </div>
  );
}
