import { useState } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../services/api';

interface DeliveryProof {
  recipientName: string;
  notes: string;
  photoPath?: string;
  signaturePath?: string;
}

export const DeliveryProofScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { shipmentId } = route.params as { shipmentId: string };

  const [proof, setProof] = useState<DeliveryProof>({
    recipientName: '',
    notes: '',
  });
  const [photoTaken, setPhotoTaken] = useState(false);
  const [signatureCaptured, setSignatureCaptured] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCapturePhoto = () => {
    Alert.alert('Camera', 'Simulated camera capture', [
      {
        text: 'Capture Photo',
        onPress: () => {
          setPhotoTaken(true);
          Alert.alert('Success', 'Package photo captured successfully');
        },
      },
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
    ]);
  };

  const handleCaptureSignature = () => {
    Alert.alert('Signature Capture', 'Simulated signature pad', [
      {
        text: 'Capture Signature',
        onPress: () => {
          setSignatureCaptured(true);
          Alert.alert('Success', 'Signature captured successfully');
        },
      },
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
    ]);
  };

  const handleScanQrCode = () => {
    navigation.navigate('BarcodeScanner', {
      mode: 'pod',
      shipmentId,
    });
    // Mark as scanned optimistically — the scanner screen posts the event itself
    setQrScanned(true);
  };

  const handleSubmitProof = async () => {
    if (!proof.recipientName.trim()) {
      Alert.alert('Validation Error', 'Please enter recipient name');
      return;
    }

    if (!photoTaken) {
      Alert.alert('Validation Error', 'Please capture a package photo');
      return;
    }

    if (!signatureCaptured) {
      Alert.alert('Validation Error', 'Please capture signature');
      return;
    }

    try {
      setSubmitting(true);
      const proofPayload = {
        recipientName: proof.recipientName,
        notes: proof.notes,
        photoPath: proof.photoPath || 'placeholder_photo_url',
        signaturePath: proof.signaturePath || 'placeholder_signature_url',
      };

      await api.post(`/api/v4/shipments/${shipmentId}/proof`, proofPayload);

      Alert.alert('Success', 'Delivery proof submitted successfully', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit delivery proof');
      console.error('Submit proof error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecipientNameChange = (text: string) => {
    setProof({ ...proof, recipientName: text });
  };

  const handleNotesChange = (text: string) => {
    setProof({ ...proof, notes: text });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Delivery Proof of Delivery</Text>
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
            style={[
              styles.captureButton,
              photoTaken && styles.captureButtonSuccess,
            ]}
            onPress={handleCapturePhoto}
            disabled={submitting}
          >
            <Text style={styles.captureButtonIcon}>
              {photoTaken ? '✓' : '📱'}
            </Text>
            <Text style={styles.captureButtonText}>
              {photoTaken ? 'Photo Captured' : 'Tap to Capture Package Photo'}
            </Text>
            {photoTaken && (
              <Text style={styles.captureButtonSubtext}>Clear photo of package</Text>
            )}
          </TouchableOpacity>

          {photoTaken && (
            <View style={styles.photoPreviewPlaceholder}>
              <Text style={styles.previewIcon}>📸</Text>
              <Text style={styles.previewText}>Photo Captured</Text>
              <Text style={styles.previewSubtext}>Ready to submit</Text>
            </View>
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
            style={[
              styles.captureButton,
              signatureCaptured && styles.captureButtonSuccess,
            ]}
            onPress={handleCaptureSignature}
            disabled={submitting}
          >
            <Text style={styles.captureButtonIcon}>
              {signatureCaptured ? '✓' : '✏'}
            </Text>
            <Text style={styles.captureButtonText}>
              {signatureCaptured ? 'Signature Captured' : 'Tap to Capture Signature'}
            </Text>
            {signatureCaptured && (
              <Text style={styles.captureButtonSubtext}>Customer has signed</Text>
            )}
          </TouchableOpacity>

          {signatureCaptured && (
            <View style={styles.signaturePreviewPlaceholder}>
              <Text style={styles.previewIcon}>✍️</Text>
              <Text style={styles.previewText}>Signature Captured</Text>
              <Text style={styles.previewSubtext}>Ready to submit</Text>
            </View>
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
            style={[
              styles.captureButton,
              qrScanned && styles.captureButtonSuccess,
            ]}
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
            style={[
              styles.textInput,
              proof.recipientName.trim() && styles.textInputFilled,
            ]}
            placeholder="Full name of recipient"
            placeholderTextColor="#64748b"
            value={proof.recipientName}
            onChangeText={handleRecipientNameChange}
            editable={!submitting}
            maxLength={100}
          />
          <Text style={styles.inputHint}>
            {proof.recipientName.length}/100 characters
          </Text>
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
              proof.notes.trim() && styles.textInputFilled,
            ]}
            placeholder="Any issues, special instructions, or notes about this delivery..."
            placeholderTextColor="#64748b"
            value={proof.notes}
            onChangeText={handleNotesChange}
            multiline
            numberOfLines={4}
            editable={!submitting}
            maxLength={500}
          />
          <Text style={styles.inputHint}>
            {proof.notes.length}/500 characters
          </Text>
        </View>

        {/* Validation Summary */}
        <View style={styles.validationContainer}>
          <View style={styles.validationItem}>
            <Text style={[
              styles.validationIcon,
              photoTaken ? styles.validationIconSuccess : styles.validationIconPending,
            ]}>
              {photoTaken ? '✓' : '○'}
            </Text>
            <Text style={[
              styles.validationText,
              photoTaken && styles.validationTextSuccess,
            ]}>
              Package Photo
            </Text>
          </View>
          <View style={styles.validationItem}>
            <Text style={[
              styles.validationIcon,
              signatureCaptured ? styles.validationIconSuccess : styles.validationIconPending,
            ]}>
              {signatureCaptured ? '✓' : '○'}
            </Text>
            <Text style={[
              styles.validationText,
              signatureCaptured && styles.validationTextSuccess,
            ]}>
              Recipient Signature
            </Text>
          </View>
          <View style={styles.validationItem}>
            <Text style={[
              styles.validationIcon,
              proof.recipientName.trim() ? styles.validationIconSuccess : styles.validationIconPending,
            ]}>
              {proof.recipientName.trim() ? '✓' : '○'}
            </Text>
            <Text style={[
              styles.validationText,
              proof.recipientName.trim() && styles.validationTextSuccess,
            ]}>
              Recipient Name
            </Text>
          </View>
          <View style={styles.validationItem}>
            <Text style={[
              styles.validationIcon,
              qrScanned ? styles.validationIconSuccess : styles.validationIconPending,
            ]}>
              {qrScanned ? '✓' : '○'}
            </Text>
            <Text style={[
              styles.validationText,
              qrScanned && styles.validationTextSuccess,
            ]}>
              QR Scan (optional)
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!photoTaken || !signatureCaptured || !proof.recipientName.trim()) &&
                styles.submitButtonDisabled,
              submitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitProof}
            disabled={
              submitting ||
              !photoTaken ||
              !signatureCaptured ||
              !proof.recipientName.trim()
            }
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
    marginBottom: 4,
  },
  captureButtonSubtext: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '500',
  },
  photoPreviewPlaceholder: {
    backgroundColor: '#2d3748',
    borderRadius: 8,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#334155',
  },
  signaturePreviewPlaceholder: {
    backgroundColor: '#2d3748',
    borderRadius: 8,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  previewText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  previewSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
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
  validationIconSuccess: {
    color: '#22c55e',
  },
  validationIconPending: {
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
