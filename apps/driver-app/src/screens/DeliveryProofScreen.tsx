import React, { useState } from 'react';
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
  const navigation = useNavigation();
  const route = useRoute();
  const { shipmentId } = route.params as { shipmentId: string };

  const [proof, setProof] = useState<DeliveryProof>({
    recipientName: '',
    notes: '',
  });
  const [photoTaken, setPhotoTaken] = useState(false);
  const [signatureCaptured, setSignatureCaptured] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCapturePhoto = () => {
    // Placeholder for camera integration (react-native-camera)
    // In production, this would open the camera and capture a photo
    Alert.alert('Camera', 'Opening camera for package photo...', [
      {
        text: 'Photo Taken',
        onPress: () => {
          setPhotoTaken(true);
          Alert.alert('Success', 'Package photo captured');
        },
      },
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
    ]);
  };

  const handleCaptureSignature = () => {
    // Placeholder for signature pad integration
    // In production, this would open a signature pad UI
    Alert.alert('Signature', 'Opening signature pad...', [
      {
        text: 'Signed',
        onPress: () => {
          setSignatureCaptured(true);
          Alert.alert('Success', 'Signature captured');
        },
      },
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
    ]);
  };

  const handleSubmitProof = async () => {
    // Validation
    if (!proof.recipientName.trim()) {
      Alert.alert('Error', 'Please enter recipient name');
      return;
    }

    if (!photoTaken) {
      Alert.alert('Error', 'Please capture a package photo');
      return;
    }

    if (!signatureCaptured) {
      Alert.alert('Error', 'Please capture signature');
      return;
    }

    try {
      setSubmitting(true);
      const proofPayload = {
        recipientName: proof.recipientName,
        notes: proof.notes,
        // In production, photoPath and signaturePath would be uploaded to storage
        // and URLs would be sent in the payload
        photoPath: proof.photoPath || 'placeholder_photo_url',
        signaturePath: proof.signaturePath || 'placeholder_signature_url',
      };

      await api.post(`/api/v4/shipments/${shipmentId}/proof`, proofPayload);

      Alert.alert('Success', 'Delivery proof submitted', [
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
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Delivery Proof</Text>
        </View>

        {/* Photo Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Package Photo</Text>
          <TouchableOpacity
            style={[styles.captureButton, photoTaken && styles.captureButtonActive]}
            onPress={handleCapturePhoto}
          >
            <Text style={styles.captureButtonIcon}>📷</Text>
            <Text style={styles.captureButtonText}>
              {photoTaken ? 'Photo Captured ✓' : 'Capture Package Photo'}
            </Text>
          </TouchableOpacity>
          {photoTaken && (
            <View style={styles.photoPreviewPlaceholder}>
              <Text style={styles.photoPreviewText}>📸 Photo Preview</Text>
            </View>
          )}
        </View>

        {/* Signature Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signature</Text>
          <TouchableOpacity
            style={[styles.captureButton, signatureCaptured && styles.captureButtonActive]}
            onPress={handleCaptureSignature}
          >
            <Text style={styles.captureButtonIcon}>✍️</Text>
            <Text style={styles.captureButtonText}>
              {signatureCaptured ? 'Signature Captured ✓' : 'Capture Signature'}
            </Text>
          </TouchableOpacity>
          {signatureCaptured && (
            <View style={styles.signaturePreviewPlaceholder}>
              <Text style={styles.signaturePreviewText}>✍️ Signature Preview</Text>
            </View>
          )}
        </View>

        {/* Recipient Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recipient Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter recipient name"
            placeholderTextColor="#999"
            value={proof.recipientName}
            onChangeText={handleRecipientNameChange}
            editable={!submitting}
          />
        </View>

        {/* Delivery Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Notes</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            placeholder="Any issues or special notes (optional)"
            placeholderTextColor="#999"
            value={proof.notes}
            onChangeText={handleNotesChange}
            multiline
            numberOfLines={4}
            editable={!submitting}
          />
        </View>

        {/* Submit Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmitProof}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Proof</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Cancel Button */}
        <View style={[styles.section, styles.lastSection]}>
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
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  lastSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  captureButton: {
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D0D0D0',
    borderStyle: 'dashed',
  },
  captureButtonActive: {
    borderColor: '#28A745',
    backgroundColor: '#F0FFF4',
  },
  captureButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  captureButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  photoPreviewPlaceholder: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  photoPreviewText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  signaturePreviewPlaceholder: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  signaturePreviewText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
  },
  textInputMultiline: {
    textAlignVertical: 'top',
    paddingVertical: 10,
  },
  submitButton: {
    backgroundColor: '#28A745',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
});
