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
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../services/api';

interface Shipment {
  id: string;
  trackingNumber: string;
  status: 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED';
  customer: {
    name: string;
    phone: string;
    deliveryAddress: string;
  };
  package: {
    weight: number;
    width: number;
    height: number;
    depth: number;
    specialInstructions?: string;
  };
  deliveryTimeSlot: {
    startTime: string;
    endTime: string;
  };
  destination?: {
    latitude: number;
    longitude: number;
  };
}

export const ShipmentScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { shipmentId } = route.params as { shipmentId: string };

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchShipment();
  }, [shipmentId]);

  const fetchShipment = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v4/shipments/${shipmentId}`);
      setShipment(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load shipment details');
      console.error('Fetch shipment error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!shipment) return;

    try {
      setUpdating(true);
      await api.patch(`/api/v4/shipments/${shipmentId}`, { status: newStatus });

      // Update local state
      setShipment({ ...shipment, status: newStatus as any });
      Alert.alert('Success', 'Shipment status updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update shipment status');
      console.error('Status update error:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleCallCustomer = () => {
    if (shipment?.customer.phone) {
      Linking.openURL(`tel:${shipment.customer.phone}`);
    }
  };

  const handleOpenMaps = () => {
    if (shipment?.destination) {
      const { latitude, longitude } = shipment.destination;
      const url = `https://maps.apple.com/?q=${latitude},${longitude}`;
      Linking.openURL(url);
    }
  };

  const handleNavigateToProof = () => {
    navigation.navigate('DeliveryProof', { shipmentId });
  };

  const getActionButtons = () => {
    if (!shipment || updating) return null;

    switch (shipment.status) {
      case 'ASSIGNED':
        return (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleStatusUpdate('PICKED_UP')}
            >
              <Text style={styles.actionButtonText}>Accept Shipment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleStatusUpdate('FAILED')}
            >
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        );
      case 'PICKED_UP':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleStatusUpdate('IN_TRANSIT')}
          >
            <Text style={styles.actionButtonText}>Start Delivery</Text>
          </TouchableOpacity>
        );
      case 'IN_TRANSIT':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleStatusUpdate('OUT_FOR_DELIVERY')}
          >
            <Text style={styles.actionButtonText}>Mark Arrived</Text>
          </TouchableOpacity>
        );
      case 'OUT_FOR_DELIVERY':
        return (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleNavigateToProof}
            >
              <Text style={styles.actionButtonText}>Mark Delivered</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleStatusUpdate('FAILED')}
            >
              <Text style={styles.actionButtonText}>Mark Failed</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      ASSIGNED: '#FFA500',
      PICKED_UP: '#4169E1',
      IN_TRANSIT: '#1E90FF',
      OUT_FOR_DELIVERY: '#FFD700',
      DELIVERED: '#28A745',
      FAILED: '#DC3545',
    };
    return statusColors[status] || '#666';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!shipment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Shipment not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.trackingNumber}>{shipment.trackingNumber}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(shipment.status) },
            ]}
          >
            <Text style={styles.statusText}>{shipment.status}</Text>
          </View>
        </View>

        {/* Customer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.card}>
            <Text style={styles.customerName}>{shipment.customer.name}</Text>
            <TouchableOpacity
              style={styles.phoneContainer}
              onPress={handleCallCustomer}
            >
              <Text style={styles.phoneText}>📞 {shipment.customer.phone}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addressContainer}
              onPress={handleOpenMaps}
            >
              <Text style={styles.addressText}>📍 {shipment.customer.deliveryAddress}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Package Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Package Details</Text>
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Weight:</Text>
              <Text style={styles.detailValue}>{shipment.package.weight} kg</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dimensions:</Text>
              <Text style={styles.detailValue}>
                {shipment.package.width}×{shipment.package.height}×{shipment.package.depth} cm
              </Text>
            </View>
            {shipment.package.specialInstructions && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Special Instructions:</Text>
                <Text style={styles.detailValue}>
                  {shipment.package.specialInstructions}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Delivery Time Slot */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Time Slot</Text>
          <View style={styles.card}>
            <Text style={styles.timeSlotText}>
              {shipment.deliveryTimeSlot.startTime} - {shipment.deliveryTimeSlot.endTime}
            </Text>
          </View>
        </View>

        {/* Map Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Destination</Text>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>📍 Map View</Text>
            <TouchableOpacity
              style={styles.mapButton}
              onPress={handleOpenMaps}
            >
              <Text style={styles.mapButtonText}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          {updating ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : (
            getActionButtons()
          )}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackingNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  phoneContainer: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  phoneText: {
    fontSize: 14,
    color: '#007AFF',
  },
  addressContainer: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginTop: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#007AFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    textAlign: 'right',
  },
  timeSlotText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  mapPlaceholder: {
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 180,
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  mapButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  mapButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#28A745',
  },
  rejectButton: {
    backgroundColor: '#DC3545',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#DC3545',
  },
});
