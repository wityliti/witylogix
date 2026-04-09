import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { offlineQueue } from '../lib/offline-queue';

interface RouteParams {
  shipmentId: string;
  photoBase64?: string;
  signatureBase64?: string;
}

export const DeliveryProofScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as RouteParams;
  const { shipmentId } = params;

  const [photoBase64, setPhotoBase64] = useState<string | undefined>(params.photoBase64);
  const [signatureBase64, setSignatureBase64] = useState<string | undefined>(
    params.signatureBase64,
  );
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [qrScanned, setQrScanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync photo/signature passed back from camera/signature screens
  useEffect(() => {
    const p = route.params as RouteParams;
    if (p.photoBase64 !== undefined) setPhotoBase64(p.photoBase64);
    if (p.signatureBase64 !== undefined) setSignatureBase64(p.signatureBase64);
  }, [route.params]);

  const handleCapturePhoto = () => {
    navigation.navigate('CameraCapture', { shipmentId });
  };

  const handleCaptureSignature = () => {
    navigation.navigate('SignaturePad', { shipmentId, photoBase64 });
  };

  const handleScanQrCode = () => {
    navigation.navigate('BarcodeScanner', { mode: 'pod', shipmentId });
    setQrScanned(true);
  };

  const handleSubmitProof = async () => {
    if (!recipientName.trim()) {
      Alert.alert('Validation Error', 'Please enter recipient name');
      return;
    }
    if (!photoBase64) {
      Alert.alert('Validation Error', 'Please capture a package photo');
      return;
    }
    if (!signatureBase64) {
      Alert.alert('Validation Error', 'Please capture recipient signature');
      return;
    }

    setSubmitting(true);
    try {
      // Capture GPS at submission time
      let latitude: number | undefined;
      let longitude: number | undefined;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
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

      // Enqueue for offline-first submission
      offlineQueue.enqueue({
        type: 'POST',
        endpoint: `/api/v4/shipments/${shipmentId}/proof-of-delivery`,
        method: 'POST',
        body: proofData,
      });

      // Try to sync immediately if online
      if (offlineQueue.isCurrentlyOnline()) {
        await offlineQueue.processQueue();
      }

      Alert.alert('Success', 'Delivery proof submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit delivery proof. It has been queued for retry.');
      console.error('Submit proof error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = !!photoBase64 && !!signatureBase64 && !!recipientName.trim();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Proof of Delivery</Text>
          <Text style={styles.headerSubtitle}>Complete all required fields</Text>
        </View>

        {/* Photo Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📷</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Package Photo</Text>
              <Text style={styles.sectionRequired}>Required</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.captureButton, photoBase64 && styles.captureButtonSuccess]}
            onPress={handleCapturePhoto}
            disabled={submitting}
          >
            <Text style={styles.captureButtonIcon}>{photoBase64 ? '✓' : '📱'}</Text>
            <Text style={styles.captureButtonText}>
              {photoBase64 ? 'Photo Captured — Tap to Retake' : 'Tap to Capture Package Photo'}
            </Text>
          </TouchableOpacity>

          {photoBase64 && (
            <Image
              source={{ uri: photoBase64 }}
              style={styles.photoPreview}
              resizeMode="cover"
            />
          )}
        </View>

        {/* Signature Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>✍</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Recipient Signature</Text>
              <Text style={styles.sectionRequired}>Required</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.captureButton, signatureBase64 && styles.captureButtonSuccess]}
            onPress={handleCaptureSignature}
            disabled={submitting}
          >
            <Text style={styles.captureButtonIcon}>{signatureBase64 ? '✓' : '✏'}</Text>
            <Text style={styles.captureButtonText}>
              {signatureBase64 ? 'Signature Captured — Tap to Redo' : 'Tap to Capture Signature'}
            </Text>
          </TouchableOpacity>

          {signatureBase64 && (
            <Image
              source={{ uri: signatureBase64 }}
              style={styles.signaturePreview}
              resizeMode="contain"
            />
          )}
        </View>

        {/* QR Code Scan Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⬛</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>QR Code Scan</Text>
              <Text style={styles.sectionOptional}>Optional — alternative POD</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.captureButton, qrScanned && styles.captureButtonSuccess]}
            onPress={handleScanQrCode}
            disabled={submitting}
          >
            <Text style={styles.captureButtonIcon}>{qrScanned ? '✓' : '⬛'}</Text>
            <Text style={styles.captureButtonText}>
              {qrScanned ? 'QR Code Scanned' : 'Scan Delivery QR Code'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recipient Name */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>👤</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Recipient Name</Text>
              <Text style={styles.sectionRequired}>Required</Text>
            </View>
          </View>
          <TextInput
            style={[styles.textInput, recipientName.trim() && styles.textInputFilled]}
            placeholder="Full name of recipient"
            placeholderTextColor="#64748b"
            value={recipientName}
            onChangeText={setRecipientName}
            editable={!submitting}
            maxLength={100}
          />
          <Text style={styles.inputHint}>{recipientName.length}/100 characters</Text>
        </View>

        {/* Delivery Notes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📝</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Delivery Notes</Text>
              <Text style={styles.sectionOptional}>Optional</Text>
            </View>
          </View>
          <TextInput
            style={[
              styles.textInput,
              styles.textInputMultiline,
              notes.trim() && styles.textInputFilled,
            ]}
            placeholder="Any issues, special instructions, or notes..."
            placeholderTextColor="#64748b"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            editable={!submitting}
            maxLength={500}
          />
          <Text style={styles.inputHint}>{notes.length}/500 characters</Text>
        </View>

        {/* Checklist */}
        <View style={styles.validationContainer}>
          {[
            { done: !!photoBase64, label: 'Package Photo' },
            { done: !!signatureBase64, label: 'Recipient Signature' },
            { done: !!recipientName.trim(), label: 'Recipient Name' },
            { done: qrScanned, label: 'QR Scan (optional)' },
          ].map(({ done, label }) => (
            <View key={label} style={styles.validationItem}>
              <Text style={[styles.validationIcon, done ? styles.iconSuccess : styles.iconPending]}>
                {done ? '✓' : '○'}
              </Text>
              <Text style={[styles.validationText, done && styles.validationTextSuccess]}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.submitButton, (!isReady || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmitProof}
            disabled={!isReady || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Submit Proof</Text>
                <Text style={styles.submitButtonIcon}>→</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={submitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1a2332',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 12,
    marginVertical: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 2,
  },
  sectionRequired: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionOptional: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  captureButton: {
    backgroundColor: '#2d3748',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#475569',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  captureButtonSuccess: {
    borderColor: '#22c55e',
    backgroundColor: '#1a3f2a',
    borderStyle: 'solid',
  },
  captureButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  captureButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#2d3748',
  },
  signaturePreview: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  textInput: {
    backgroundColor: '#2d3748',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#e2e8f0',
    marginBottom: 6,
  },
  textInputFilled: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e293b',
  },
  textInputMultiline: {
    textAlignVertical: 'top',
    paddingVertical: 11,
    minHeight: 80,
  },
  inputHint: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 4,
  },
  validationContainer: {
    marginHorizontal: 12,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#2d3748',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  validationIcon: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
    minWidth: 20,
  },
  iconSuccess: {
    color: '#22c55e',
  },
  iconPending: {
    color: '#64748b',
  },
  validationText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  validationTextSuccess: {
    color: '#22c55e',
  },
  actionContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#475569',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  submitButtonIcon: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#2d3748',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  cancelButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
});
