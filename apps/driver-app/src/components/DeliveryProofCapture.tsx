/**
 * DeliveryProofCapture - React Native proof of delivery component
 * Uses expo-camera for photo, PanResponder + SVG for signature, expo-location for GPS.
 * Submissions are queued offline-first via OfflineQueue.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  PanResponder,
  Dimensions,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { CameraView as CameraViewImpl, useCameraPermissions } from 'expo-camera';
import SvgImpl, { Path as PathImpl } from 'react-native-svg';
import * as Location from 'expo-location';
import type { CameraView as CameraViewType } from 'expo-camera';

// expo-camera v16 and react-native-svg v15 have a `refs` mismatch with React 18 class types
const CameraView = CameraViewImpl as unknown as React.ComponentType<any>;
const Svg = SvgImpl as unknown as React.ComponentType<any>;
const Path = PathImpl as unknown as React.ComponentType<any>;
import { offlineQueue } from '../lib/offline-queue';

interface DeliveryProofCaptureProps {
  shipmentId: string;
  recipientName?: string;
  onSubmitSuccess?: (operationId: string) => void;
  onSubmitError?: (error: Error) => void;
}

const PAD_HEIGHT = 160;
const PAD_WIDTH = Dimensions.get('window').width - 64; // accounting for padding

type Step = 'form' | 'camera' | 'signature';

const DeliveryProofCapture: React.FC<DeliveryProofCaptureProps> = ({
  shipmentId,
  recipientName: initialRecipientName = '',
  onSubmitSuccess,
  onSubmitError,
}) => {
  const [step, setStep] = useState<Step>('form');
  const [recipientName, setRecipientName] = useState(initialRecipientName);
  const [notes, setNotes] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>();
  const [signatureBase64, setSignatureBase64] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const cameraRef = useRef<CameraViewType>(null);

  // Signature
  const [completedPaths, setCompletedPaths] = useState<string[]>([]);
  const currentPathRef = useRef('');
  const [, forceRender] = useState(0);

  const signaturePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPathRef.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        forceRender((n) => n + 1);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPathRef.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        forceRender((n) => n + 1);
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          setCompletedPaths((prev) => [...prev, currentPathRef.current]);
          currentPathRef.current = '';
        }
      },
    }),
  ).current;

  // ─── Camera step ──────────────────────────────────────────

  const handleOpenCamera = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission required', 'Camera access is needed to capture delivery proof.');
        return;
      }
    }
    setPhotoPreview(null);
    setStep('camera');
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (photo?.base64) {
        setPhotoPreview(`data:image/jpeg;base64,${photo.base64}`);
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleUsePhoto = () => {
    if (photoPreview) {
      setPhotoBase64(photoPreview);
    }
    setStep('form');
  };

  // ─── Signature step ───────────────────────────────────────

  const handleClearSignature = () => {
    setCompletedPaths([]);
    currentPathRef.current = '';
    forceRender((n) => n + 1);
  };

  const handleConfirmSignature = () => {
    if (completedPaths.length === 0) {
      Alert.alert('No signature', 'Please draw a signature first.');
      return;
    }
    const pathElements = completedPaths
      .map(
        (d) =>
          `<path d="${d}" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
      .join('');
    const svgXml = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${PAD_WIDTH}" height="${PAD_HEIGHT}">`,
      `<rect width="${PAD_WIDTH}" height="${PAD_HEIGHT}" fill="white"/>`,
      pathElements,
      '</svg>',
    ].join('');
    setSignatureBase64(`data:image/svg+xml;base64,${btoa(svgXml)}`);
    setStep('form');
  };

  // ─── Submit ───────────────────────────────────────────────

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
      let latitude: number | undefined;
      let longitude: number | undefined;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }

      const proofData = {
        shipmentId,
        recipientName: recipientName.trim(),
        notes: notes.trim(),
        photoBase64,
        signatureBase64,
        latitude,
        longitude,
        timestamp: Date.now(),
      };

      const operationId = offlineQueue.enqueue({
        type: 'POST',
        endpoint: `/api/v4/shipments/${shipmentId}/proof-of-delivery`,
        method: 'POST',
        body: proofData,
      });

      if (offlineQueue.isCurrentlyOnline()) {
        await offlineQueue.processQueue();
      }

      onSubmitSuccess?.(operationId);

      // Reset form
      setRecipientName('');
      setNotes('');
      setPhotoBase64(undefined);
      setSignatureBase64(undefined);
      setCompletedPaths([]);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      onSubmitError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Camera step UI ───────────────────────────────────────

  if (step === 'camera') {
    if (!cameraPermission?.granted) {
      return (
        <View style={styles.centered}>
          <Text style={styles.permText}>Camera permission is required.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestCameraPermission}>
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('form')}>
            <Text style={styles.linkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (photoPreview) {
      return (
        <View style={styles.cameraContainer}>
          <Image source={{ uri: photoPreview }} style={styles.fullPreview} resizeMode="cover" />
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhotoPreview(null)}>
              <Text style={styles.secondaryBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleUsePhoto}>
              <Text style={styles.primaryBtnText}>Use Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <View style={styles.shutterRow}>
              <TouchableOpacity onPress={() => setStep('form')}>
                <Text style={styles.cancelWhite}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shutter, capturing && styles.shutterDisabled]}
                onPress={handleTakePhoto}
                disabled={capturing}
              >
                {capturing ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <View style={styles.shutterInner} />
                )}
              </TouchableOpacity>
              <View style={{ width: 56 }} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  // ─── Signature step UI ────────────────────────────────────

  if (step === 'signature') {
    const allPaths = completedPaths.concat(
      currentPathRef.current ? [currentPathRef.current] : [],
    );
    const hasStrokes = completedPaths.length > 0 || currentPathRef.current.length > 0;

    return (
      <View style={styles.signatureContainer}>
        <Text style={styles.stepTitle}>Recipient Signature</Text>
        <Text style={styles.stepSubtitle}>Ask the recipient to sign below</Text>

        <View style={styles.padWrapper} {...signaturePanResponder.panHandlers}>
          <Svg width={PAD_WIDTH} height={PAD_HEIGHT} style={styles.svgPad}>
            {allPaths.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke="#1e293b"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
          {!hasStrokes && (
            <View style={styles.padPlaceholder} pointerEvents="none">
              <Text style={styles.padPlaceholderText}>Draw signature here</Text>
            </View>
          )}
        </View>

        <View style={styles.signatureActions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleClearSignature}
            disabled={!hasStrokes}
          >
            <Text style={[styles.secondaryBtnText, !hasStrokes && { color: '#64748b' }]}>
              Clear
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, !hasStrokes && styles.primaryBtnDisabled]}
            onPress={handleConfirmSignature}
            disabled={!hasStrokes}
          >
            <Text style={styles.primaryBtnText}>Confirm</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setStep('form')} style={styles.cancelRow}>
          <Text style={styles.linkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Main form UI ─────────────────────────────────────────

  return (
    <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>Delivery Proof</Text>

      {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      {/* Recipient Name */}
      <Text style={styles.label}>Recipient Name *</Text>
      <TextInput
        style={styles.input}
        value={recipientName}
        onChangeText={setRecipientName}
        placeholder="Enter recipient name"
        placeholderTextColor="#64748b"
        maxLength={100}
        editable={!isSubmitting}
      />

      {/* Photo */}
      <Text style={styles.label}>Package Photo *</Text>
      {photoBase64 ? (
        <View>
          <Image source={{ uri: photoBase64 }} style={styles.thumbPreview} resizeMode="cover" />
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleOpenCamera}>
            <Text style={styles.secondaryBtnText}>Retake Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.captureBtn} onPress={handleOpenCamera}>
          <Text style={styles.captureBtnText}>📷  Take Photo</Text>
        </TouchableOpacity>
      )}

      {/* Signature */}
      <Text style={[styles.label, { marginTop: 16 }]}>Recipient Signature *</Text>
      {signatureBase64 ? (
        <View>
          <Image
            source={{ uri: signatureBase64 }}
            style={styles.sigPreview}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('signature')}>
            <Text style={styles.secondaryBtnText}>Redo Signature</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.captureBtn} onPress={() => setStep('signature')}>
          <Text style={styles.captureBtnText}>✍️  Capture Signature</Text>
        </TouchableOpacity>
      )}

      {/* Notes */}
      <Text style={[styles.label, { marginTop: 16 }]}>Notes (Optional)</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Add any delivery notes..."
        placeholderTextColor="#64748b"
        multiline
        numberOfLines={3}
        maxLength={500}
        editable={!isSubmitting}
      />

      {/* Submit */}
      <TouchableOpacity
        style={[
          styles.primaryBtn,
          styles.submitBtn,
          (!recipientName || !photoBase64 || !signatureBase64 || isSubmitting) &&
            styles.primaryBtnDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!recipientName || !photoBase64 || !signatureBase64 || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Submit Proof</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: 36 },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  cancelWhite: { color: '#fff', fontSize: 14, fontWeight: '600', width: 56 },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  shutterDisabled: { opacity: 0.6 },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ccc',
  },
  fullPreview: { flex: 1 },
  previewActions: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  // Signature
  signatureContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  stepTitle: { fontSize: 18, fontWeight: '700', color: '#e2e8f0', marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 20 },
  padWrapper: {
    width: PAD_WIDTH,
    height: PAD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    overflow: 'hidden',
    position: 'relative',
  },
  svgPad: { backgroundColor: '#fff' },
  padPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  padPlaceholderText: { color: '#cbd5e1', fontSize: 14, fontStyle: 'italic' },
  signatureActions: { flexDirection: 'row', marginTop: 16, gap: 12 },
  cancelRow: { alignItems: 'center', paddingVertical: 16 },
  // Form
  form: { flex: 1, backgroundColor: '#0f172a' },
  formContent: { padding: 16 },
  formTitle: { fontSize: 20, fontWeight: '700', color: '#e2e8f0', marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#e2e8f0',
    marginBottom: 16,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  captureBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 8,
  },
  captureBtnText: { color: '#93c5fd', fontSize: 14, fontWeight: '600' },
  thumbPreview: { width: '100%', height: 160, borderRadius: 8, marginBottom: 8 },
  sigPreview: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  submitBtn: { marginTop: 16, paddingVertical: 14 },
  // Shared
  primaryBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#475569' },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  secondaryBtnText: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  centered: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permText: { color: '#cbd5e1', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  linkText: { color: '#64748b', fontSize: 14 },
  errorBox: {
    backgroundColor: '#450a0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  errorText: { color: '#fca5a5', fontSize: 13 },
});

export default DeliveryProofCapture;
