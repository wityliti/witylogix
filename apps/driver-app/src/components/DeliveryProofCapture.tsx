/**
 * DeliveryProofCapture - Proof of delivery with photo, signature, and notes
 */

import React, { useRef, useState, useEffect } from 'react';
import { offlineQueue } from '../lib/offline-queue';
import { locationService } from '../lib/location-service';

interface DeliveryProofCaptureProps {
  shipmentId: string;
  recipientName?: string;
  onSubmitSuccess?: (proofId: string) => void;
  onSubmitError?: (error: Error) => void;
}

interface ProofData {
  shipmentId: string;
  recipientName: string;
  notes: string;
  photoBase64?: string;
  signatureBase64?: string;
  latitude?: number;
  longitude?: number;
  timestamp: number;
}

const DeliveryProofCapture: React.FC<DeliveryProofCaptureProps> = ({
  shipmentId,
  recipientName: initialRecipientName = '',
  onSubmitSuccess,
  onSubmitError,
}) => {
  const [recipientName, setRecipientName] = useState(initialRecipientName);
  const [notes, setNotes] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>();
  const [signatureBase64, setSignatureBase64] = useState<string | undefined>();
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Get current location on mount
  useEffect(() => {
    const getLocation = async () => {
      const location = await locationService.getCurrentPosition();
      if (location) {
        setLatitude(location.latitude);
        setLongitude(location.longitude);
      }
    };
    getLocation();
  }, []);

  // Handle photo capture
  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoBase64(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle signature drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setSignatureBase64(undefined);
    }
  };

  const captureSignature = () => {
    if (canvasRef.current) {
      setSignatureBase64(canvasRef.current.toDataURL('image/png'));
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    setError(null);

    if (!recipientName.trim()) {
      setError('Recipient name is required');
      return;
    }

    if (!photoBase64) {
      setError('Photo is required');
      return;
    }

    if (!signatureBase64) {
      setError('Signature is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const proofData: ProofData = {
        shipmentId,
        recipientName: recipientName.trim(),
        notes: notes.trim(),
        photoBase64,
        signatureBase64,
        latitude,
        longitude,
        timestamp: Date.now(),
      };

      // Queue the operation if offline
      const operationId = offlineQueue.enqueue({
        type: 'POST',
        endpoint: '/api/delivery-proofs',
        method: 'POST',
        body: proofData,
      });

      // Try to sync immediately if online
      if (offlineQueue.isCurrentlyOnline()) {
        await offlineQueue.processQueue();
      }

      if (onSubmitSuccess) {
        onSubmitSuccess(operationId);
      }

      // Reset form
      setRecipientName('');
      setNotes('');
      setPhotoBase64(undefined);
      clearSignature();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      if (onSubmitError) {
        onSubmitError(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
      }}
    >
      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
        Delivery Proof
      </h3>

      {error && (
        <div
          style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Recipient Name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '14px', fontWeight: '500' }}>Recipient Name</label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="Enter recipient name"
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Photo Capture */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '14px', fontWeight: '500' }}>Photo Proof</label>
        {photoBase64 ? (
          <div
            style={{
              position: 'relative',
              width: '100%',
              backgroundColor: '#e0e0e0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <img
              src={photoBase64}
              alt="Proof of delivery"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '300px',
                objectFit: 'cover',
              }}
            />
            <button
              onClick={() => setPhotoBase64(undefined)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <button
            onClick={handleCameraClick}
            style={{
              padding: '12px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            📷 Take Photo
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Signature Pad */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '14px', fontWeight: '500' }}>Signature</label>
        <div
          style={{
            border: '2px solid #ddd',
            borderRadius: '4px',
            backgroundColor: 'white',
            padding: '4px',
          }}
        >
          <canvas
            ref={canvasRef}
            width={280}
            height={120}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            style={{
              cursor: 'crosshair',
              display: 'block',
              width: '100%',
              backgroundColor: 'white',
              borderRadius: '2px',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={captureSignature}
            disabled={!isDrawing && !signatureBase64}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Save Signature
          </button>
          <button
            onClick={clearSignature}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
        {signatureBase64 && (
          <div style={{ fontSize: '12px', color: '#4CAF50', fontWeight: '500' }}>
            ✓ Signature captured
          </div>
        )}
      </div>

      {/* Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '14px', fontWeight: '500' }}>Notes (Optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any additional notes..."
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '80px',
          }}
        />
      </div>

      {/* Location */}
      {latitude && longitude && (
        <div
          style={{
            fontSize: '12px',
            color: '#666',
            padding: '8px',
            backgroundColor: 'white',
            borderRadius: '4px',
          }}
        >
          📍 Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !recipientName || !photoBase64 || !signatureBase64}
        style={{
          padding: '12px',
          backgroundColor: isSubmitting ? '#ccc' : '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
        }}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Proof'}
      </button>
    </div>
  );
};

export default DeliveryProofCapture;
