import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';
import { api } from '../services/api';
import {
  captureStatusTransition,
  capturePodSignature,
  StatusTransitionType,
} from '../services/offline-event-service';
import { syncManager } from '../services/sync-manager';
import { connectivityMonitor } from '../services/connectivity-monitor';
import OfflineIndicator from '../components/OfflineIndicator';

interface CustomerPreferences {
  deliveryMethod?: 'door' | 'signature' | 'neighbor';
  safePlace?: string;
  instructions?: string;
  rescheduleDate?: string;
  rescheduleTimeWindow?: string;
  redirectAddress?: {
    line1: string;
    city: string;
    postalCode: string;
  };
  phoneNumber?: string;
  updatedAt?: string;
}

interface Delivery {
  id: string;
  customerName: string;
  address: string;
  phone: string;
  status: string;
  preferences?: CustomerPreferences;
}

const STATUS_MAP: Record<string, StatusTransitionType> = {
  arrived: 'in_transit',
  delivered: 'delivered',
  failed: 'failed_delivery',
};

const DeliveryScreen: React.FC = () => {
  const route = useRoute<any>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, requestCameraPermission] = useCameraPermissions();

  const { deliveryId } = route.params || {};

  useEffect(() => {
    if (deliveryId) {
      fetchDelivery();
    }
  }, [deliveryId]);

  const fetchDelivery = async () => {
    try {
      setIsLoading(true);
      const data = await api.get(`/api/v4/deliveries/${deliveryId}`);
      setDelivery(data);
    } catch (error) {
      console.error('Failed to fetch delivery:', error);
      Alert.alert('Error', 'Failed to load delivery details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required');
        return;
      }

      const pickerResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setProofImage(pickerResult.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!delivery) return;
    try {
      setIsSubmitting(true);

      const offlineStatus = STATUS_MAP[newStatus] ?? (newStatus as StatusTransitionType);

      // Always write to offline queue first (works regardless of connectivity)
      await captureStatusTransition(delivery.id, offlineStatus, { notes: notes || undefined });

      // If a POD image is captured, record it as a pod_signature event
      if (proofImage && (newStatus === 'delivered' || newStatus === 'arrived')) {
        await capturePodSignature(delivery.id, proofImage, { notes: notes || undefined });
      }

      // Optimistically update UI
      setDelivery((prev) => prev ? { ...prev, status: newStatus } : prev);

      // Attempt immediate sync if online
      if (connectivityMonitor.isCurrentlyOnline()) {
        syncManager.flush().catch(() => {});
      }

      Alert.alert('Saved', `Delivery status saved${connectivityMonitor.isCurrentlyOnline() ? '' : ' offline — will sync when connected'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save delivery status');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <OfflineIndicator />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#005bd3" />
        </View>
      </SafeAreaView>
    );
  }

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container}>
        <OfflineIndicator />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Delivery not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <OfflineIndicator />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.customerName}>{delivery.customerName}</Text>
          <Text style={styles.address}>{delivery.address}</Text>
          <TouchableOpacity style={styles.phoneButton}>
            <Text style={styles.phoneText}>{delivery.phone}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>Route Map (Integration Ready)</Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <View style={[styles.statusBadge, getStatusColor(delivery.status)]}>
            <Text style={styles.statusValue}>{delivery.status}</Text>
          </View>
        </View>

        {/* Customer delivery preferences */}
        {delivery.preferences && (
          <View style={[styles.section, styles.preferencesCard]}>
            <Text style={styles.sectionTitle}>Customer Instructions</Text>
            {delivery.preferences.deliveryMethod && (
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Method</Text>
                <Text style={styles.prefValue}>
                  {delivery.preferences.deliveryMethod === 'door' && 'Leave at Door'}
                  {delivery.preferences.deliveryMethod === 'signature' && 'Require Signature'}
                  {delivery.preferences.deliveryMethod === 'neighbor' && 'Leave with Neighbour'}
                </Text>
              </View>
            )}
            {!!delivery.preferences.safePlace && (
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Safe Place</Text>
                <Text style={styles.prefValue}>{delivery.preferences.safePlace}</Text>
              </View>
            )}
            {!!delivery.preferences.instructions && (
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Instructions</Text>
                <Text style={styles.prefValue}>{delivery.preferences.instructions}</Text>
              </View>
            )}
            {delivery.preferences.redirectAddress && (
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Redirect To</Text>
                <Text style={styles.prefValue}>
                  {delivery.preferences.redirectAddress.line1},{' '}
                  {delivery.preferences.redirectAddress.city}{' '}
                  {delivery.preferences.redirectAddress.postalCode}
                </Text>
              </View>
            )}
            {!!delivery.preferences.rescheduleDate && (
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Reschedule</Text>
                <Text style={styles.prefValue}>
                  {delivery.preferences.rescheduleDate}
                  {delivery.preferences.rescheduleTimeWindow &&
                    delivery.preferences.rescheduleTimeWindow !== 'anytime' &&
                    ` (${delivery.preferences.rescheduleTimeWindow})`}
                </Text>
              </View>
            )}
            {!!delivery.preferences.phoneNumber && (
              <View style={styles.prefRow}>
                <Text style={styles.prefLabel}>Contact</Text>
                <Text style={styles.prefValue}>{delivery.preferences.phoneNumber}</Text>
              </View>
            )}
            {delivery.preferences.updatedAt && (
              <Text style={styles.prefUpdated}>
                Updated {new Date(delivery.preferences.updatedAt).toLocaleTimeString()}
              </Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proof of Delivery</Text>

          {proofImage && (
            <Image source={{ uri: proofImage }} style={styles.proofImage} />
          )}

          <TouchableOpacity
            style={styles.photoButton}
            onPress={handleTakePhoto}
            disabled={isSubmitting}
          >
            <Text style={styles.photoButtonText}>
              {proofImage ? 'Retake Photo' : 'Take Photo'}
            </Text>
          </TouchableOpacity>

          <View style={styles.signatureContainer}>
            <Text style={styles.signatureLabel}>Signature (Coming Soon)</Text>
            <View style={styles.signaturePlaceholder}>
              <Text style={styles.signatureText}>Signature pad will be integrated here</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any delivery notes..."
            placeholderTextColor="#999"
            value={notes}
            onChangeText={setNotes}
            multiline
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.actionContainer}>
          {delivery.status === 'pending' && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleStatusUpdate('arrived')}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Mark as Arrived</Text>
              )}
            </TouchableOpacity>
          )}
          {delivery.status === 'arrived' && (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => handleStatusUpdate('delivered')}
                disabled={isSubmitting || !proofImage}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Complete Delivery</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => handleStatusUpdate('failed')}
                disabled={isSubmitting}
              >
                <Text style={styles.secondaryButtonText}>Mark as Failed</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'delivered':
      return { backgroundColor: '#e8f5e9' };
    case 'arrived':
      return { backgroundColor: '#fff3e0' };
    case 'failed':
      return { backgroundColor: '#ffebee' };
    default:
      return { backgroundColor: '#f5f5f5' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  customerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#202223',
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  phoneButton: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  phoneText: {
    color: '#005bd3',
    fontSize: 14,
    fontWeight: '600',
  },
  mapPlaceholder: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mapText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#005bd3',
  },
  statusCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#005bd3',
  },
  section: {
    paddingHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202223',
    marginBottom: 12,
  },
  photoButton: {
    backgroundColor: '#005bd3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  photoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  signatureContainer: {
    marginTop: 16,
  },
  signatureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202223',
    marginBottom: 8,
  },
  signaturePlaceholder: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 20,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureText: {
    fontSize: 14,
    color: '#999',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#202223',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#005bd3',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#202223',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  preferencesCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#005bd3',
    backgroundColor: '#f0f7ff',
  },
  prefRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  prefLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#005bd3',
    width: 90,
    marginTop: 1,
  },
  prefValue: {
    fontSize: 13,
    color: '#202223',
    flex: 1,
    lineHeight: 18,
  },
  prefUpdated: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default DeliveryScreen;
