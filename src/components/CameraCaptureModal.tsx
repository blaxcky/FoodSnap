import { useEffect, useRef, useState } from 'react';
import { CameraIcon } from './Icons';

interface CameraCaptureModalProps {
  onCancel: () => void;
  onCapture: (blob: Blob) => void | Promise<void>;
  onFallback: () => void;
}

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Camera access was blocked. Allow camera permission or switch back to the standard camera flow.';
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No usable rear camera was found on this device.';
    }

    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'The camera is currently busy in another app.';
    }
  }

  return 'The direct camera could not be opened on this device.';
}

export function CameraCaptureModal({
  onCancel,
  onCapture,
  onFallback
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    const { documentElement, body } = document;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = documentElement.style.overscrollBehavior;
    const previousOverflow = body.style.overflow;
    const previousOverscrollBehavior = body.style.overscrollBehavior;

    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setError('Direct camera capture is not supported here. Switch back to the standard camera flow.');
      return;
    }

    let active = true;

    void navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        },
        audio: false
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const videoElement = videoRef.current;

        if (!videoElement) {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          return;
        }

        videoElement.srcObject = stream;
        void videoElement.play().catch(() => undefined);
      })
      .catch((cameraError) => {
        if (active) {
          setError(getCameraErrorMessage(cameraError));
        }
      });

    return () => {
      active = false;

      const currentStream = streamRef.current;
      streamRef.current = null;
      currentStream?.getTracks().forEach((track) => track.stop());

      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, []);

  function handleLoadedMetadata() {
    setIsCameraReady(true);
    setError('');
  }

  function handleFallbackClick() {
    onCancel();
    window.setTimeout(() => {
      onFallback();
    }, 0);
  }

  async function handleCaptureClick() {
    if (!videoRef.current || isCapturing) {
      return;
    }

    const video = videoRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width <= 0 || height <= 0) {
      setError('The camera preview is not ready yet.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      setError('The camera image could not be prepared.');
      return;
    }

    setIsCapturing(true);
    setError('');
    context.drawImage(video, 0, 0, width, height);

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (nextBlob) => {
            if (!nextBlob) {
              reject(new Error('capture-failed'));
              return;
            }

            resolve(nextBlob);
          },
          'image/jpeg',
          0.92
        );
      });

      await onCapture(blob);
    } catch {
      if (isMountedRef.current) {
        setError('The captured photo could not be stored.');
        setIsCapturing(false);
      }
      return;
    }

    if (isMountedRef.current) {
      setIsCapturing(false);
    }
  }

  return (
    <div className="modal-backdrop camera-capture-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="modal-card camera-capture-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-capture-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading modal-heading">
          <div>
            <p className="section-kicker">Camera</p>
            <h2 id="camera-capture-title">Direct capture</h2>
          </div>
          <button className="ghost-button compact" type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <div className="camera-capture-stage">
          {error ? (
            <div className="camera-capture-empty-state" role="status" aria-live="polite">
              <CameraIcon className="ui-icon" />
              <p>{error}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              className={`camera-capture-video${isCameraReady ? ' ready' : ''}`}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
            />
          )}
        </div>

        <p className="settings-feedback camera-capture-copy">
          {error
            ? 'You can switch back to the standard Android camera flow at any time in Settings.'
            : 'This mode captures the frame directly inside FoodSnap and skips the Android confirmation screen.'}
        </p>

        <div className="modal-actions camera-capture-actions">
          <button className="ghost-button" type="button" onClick={handleFallbackClick}>
            Use standard camera
          </button>
          <button
            className="primary-button modal-save-button"
            type="button"
            onClick={() => void handleCaptureClick()}
            disabled={!isCameraReady || isCapturing || Boolean(error)}
          >
            {isCapturing ? 'Saving...' : 'Capture now'}
          </button>
        </div>
      </section>
    </div>
  );
}
