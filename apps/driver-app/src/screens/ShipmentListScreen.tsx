import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';

interface ShipmentCardItem {
  id: string;
  trackingNumber: string;
  customerName: string;
  address: string;
  status: 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED';
  eta: string;
}

interface ShipmentStats {
  total: number;
  pending: number;
  delivered: number;
  failed: number;
}

export const ShipmentListScreen = () => {
  const navigation = useNavigation();

  const [shipments, setShipments] = useState<ShipmentCardItem[]>([]);
  const [stats, setStats] = useState<ShipmentStats>({
    total: 0,
    pending: 0,
    delivered: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchShipments();
    }, [])
  );

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v4/shipments/today');
      const shipmentsData = response.data.shipments || [];

      setShipments(shipmentsData);

      // Calculate stats
      const statsData: ShipmentStats = {
        total: shipmentsData.length,
        pending: shipmentsData.filter(
          (s: ShipmentCardItem) =>
            s.status === 'ASSIGNED' ||
            s.status === 'PICKED_UP' ||
            s.status === 'IN_TRANSIT' ||
            s.status === 'OUT_FOR_DELIVERY'
        ).length,
        delivered: shipmentsData.filter(
          (s: ShipmentCardItem) => s.status === 'DELIVERED'
        ).length,
        failed: shipmentsData.filter(
          (s: ShipmentCardItem) => s.status === 'FAILED'
        ).length,
      };

      setStats(statsData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load shipments');
      console.error('Fetch shipments error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchShipments();
    setRefreshing(false);
  };

  const handleShipmentPress = (shipmentId: string) => {
    navigation.navigate('Shipment', { shipmentId });
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

  const truncateAddress = (address: string, maxLength: number = 40) => {
    return address.length > maxLength
      ? address.substring(0, maxLength) + '...'
      : address;
  };

  const renderShipmentCard = ({ item }: { item: ShipmentCardItem }) => (
    <TouchableOpacity
      style={styles.shipmentCard}
      onPress={() => handleShipmentPress(item.id)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.trackingSection}>
          <Text style={styles.trackingLabel}>Tracking #</Text>
          <Text style={styles.trackingNumber}>{item.trackingNumber}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <Text style={styles.address}>{truncateAddress(item.address)}</Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.etaLabel}>ETA:</Text>
        <Text style={styles.etaTime}>{item.eta}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📦</Text>
      <Text style={styles.emptyTitle}>No Shipments Today</Text>
      <Text style={styles.emptySubtitle}>You have no deliveries assigned for today</Text>
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={handleRefresh}
      >
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && shipments.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today's Shipments</Text>
        <Text style={styles.headerSubtitle}>
          {stats.total} {stats.total === 1 ? 'delivery' : 'deliveries'}
        </Text>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#FFA500' }]}>
            {stats.pending}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#28A745' }]}>
            {stats.delivered}
          </Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#DC3545' }]}>
            {stats.failed}
          </Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* Shipments List */}
      <FlatList
        data={shipments}
        keyExtractor={(item) => item.id}
        renderItem={renderShipmentCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#007AFF']}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsBar: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },
  shipmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  trackingSection: {
    flex: 1,
  },
  trackingLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  trackingNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9F9F9',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  etaLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  etaTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginLeft: 6,
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    color: '#CCC',
    fontWeight: '300',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
