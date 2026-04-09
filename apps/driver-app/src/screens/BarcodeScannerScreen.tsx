import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,

  Vibration,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../services/api';
import {
  validatePickupBarcode,
  validatePodBarcode,
  SUPPORTED_BARCODE_TYPES,
} from '../lib/barcodeValidation';

type ScanMode = 'pickup' | 'pod';

interface RouteParms {
  mode: ScanMode;
  shipmentId: string;
  expectedBarcode?: string;
}

export const BarcodeScannerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { mode, shipmentId, expectedBarcode } = route.params as RouteParms;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleBarCodeScanned = useCallback(
    async ({ type, data }: { type: string; data: string }) => {
      if (scanned || submitting) return;

      // Validate depending on mode
      const validation =
        mode === 'pickup'
          ? validatePickupBarcode(data, expectedBarcode ?? '')
          : validatePodBarcode(data);

      if (!validation.valid) {
        Vibration.vibrate([0, 200, 100, 200]); // error pattern
        setScanResult({ success: false, message: validation.error ?? 'Scan failed' });
        setScanned(true);
        return;
      }

      Vibration.vibrate(100); // success
      setScanned(true);
      setSubmitting(true);

      try {
        const eventType = mode === 'pickup' ? 'picked_up' : 'delivered';
        const eventId = `scan-${shipmentId}-${Date.now()}`;

        await api.post('/api/v4/deliveries/events/batch', {
          events: [
            {
              id: eventId,
              eventType,
              deliveryId: shipmentId,
              payload: {
                scanCode: data,
                barcodeType: type,
                scanMode: mode,
              },
              deviceCapturedAt: new Date().toISOString(),
              deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          ],
        });

        setScanResult({
          success: true,
          message:
            mode === 'pickup'
              ? 'Package scanned successfully. Pickup confirmed!'
              : 'QR code scanned. POD confirmed!',
        });
      } catch {
        setScanResult({
          success: false,
          message: 'Failed to record scan event. Please try again.',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [scanned, submitting, mode, shipmentId, expectedBarcode],
  );

  const handleRetry = () => {
    setScanned(false);
    setScanResult(null);
  };

  const handleDone = () => {
    navigation.goBack();
  };

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#005bd3" />
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          Camera access is required to scan barcodes.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [...SUPPORTED_BARCODE_TYPES],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {mode === 'pickup' ? 'Scan Package Barcode' : 'Scan QR Code (POD)'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {mode === 'pickup'
              ? 'Align the barcode within the frame to confirm pickup'
              : 'Scan the QR code on the delivery label to confirm delivery'}
          </Text>
        </View>

        {/* Scan frame */}
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>

        {/* Result overlay */}
        {scanResult && (
          <View
            style={[
              styles.resultCard,
              scanResult.success ? styles.resultSuccess : styles.resultError,
            ]}
          >
            <Text style={styles.resultIcon}>{scanResult.success ? '✓' : '✗'}</Text>
            <Text style={styles.resultMessage}>{scanResult.message}</Text>

            {submitting && <ActivityIndicator color="#fff" style={styles.spinner} />}

            {!submitting && (
              <View style={styles.resultButtons}>
                {!scanResult.success && (
                  <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                )}
                {scanResult.success && (
                  <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Cancel */}
        {!scanResult && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const CORNER_SIZE = 28;
const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f172a',
  },
  permissionText: {
    fontSize: 16,
    color: '#e2e8f0',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#005bd3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  header: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#fff',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  resultCard: {
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '90%',
  },
  resultSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.92)',
  },
  resultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
  },
  resultIcon: {
    fontSize: 36,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 8,
  },
  resultMessage: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  spinner: {
    marginTop: 12,
  },
  resultButtons: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '600',
  },
});
