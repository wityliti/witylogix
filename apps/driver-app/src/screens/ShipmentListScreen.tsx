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
  TextInput,
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
  timeSlot?: string;
}

interface ShipmentStats {
  total: number;
  pending: number;
  delivered: number;
  failed: number;
}

type FilterStatus = 'all' | 'pending' | 'in_transit' | 'delivered';

export const ShipmentListScreen = () => {
  const navigation = useNavigation();

  const [shipments, setShipments] = useState<ShipmentCardItem[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<ShipmentCardItem[]>([]);
  const [stats, setStats] = useState<ShipmentStats>({
    total: 0,
    pending: 0,
    delivered: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  useFocusEffect(
    React.useCallback(() => {
      fetchShipments();
    }, [])
  );

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v4/shipments/today');
      const shipmentsData = response.data.shipments || response.data || [];

      setShipments(shipmentsData);
      applyFiltersAndSearch(shipmentsData, activeFilter, searchQuery);

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

  const applyFiltersAndSearch = (data: ShipmentCardItem[], filter: FilterStatus, query: string) => {
    let filtered = data;

    // Apply filter
    if (filter !== 'all') {
      if (filter === 'pending') {
        filtered = filtered.filter(s =>
          ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status)
        );
      } else if (filter === 'in_transit') {
        filtered = filtered.filter(s =>
          ['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status)
        );
      } else if (filter === 'delivered') {
        filtered = filtered.filter(s => s.status === 'DELIVERED');
      }
    }

    // Apply search
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(s =>
        s.customerName.toLowerCase().includes(lowerQuery) ||
        s.trackingNumber.toLowerCase().includes(lowerQuery) ||
        s.address.toLowerCase().includes(lowerQuery)
      );
    }

    setFilteredShipments(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchShipments();
    setRefreshing(false);
  };

  const handleFilterPress = (filter: FilterStatus) => {
    setActiveFilter(filter);
    applyFiltersAndSearch(shipments, filter, searchQuery);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    applyFiltersAndSearch(shipments, activeFilter, text);
  };

  const handleShipmentPress = (shipmentId: string) => {
    navigation.navigate('Shipment', { shipmentId });
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      ASSIGNED: '#f59e0b',
      PICKED_UP: '#3b82f6',
      IN_TRANSIT: '#06b6d4',
      OUT_FOR_DELIVERY: '#ec4899',
      DELIVERED: '#22c55e',
      FAILED: '#ef4444',
    };
    return statusColors[status] || '#6b7280';
  };

  const truncateAddress = (address: string, maxLength: number = 45) => {
    return address.length > maxLength
      ? address.substring(0, maxLength) + '...'
      : address;
  };

  const renderFilterTab = (label: string, value: FilterStatus) => (
    <TouchableOpacity
      style={[styles.filterTab, activeFilter === value && styles.filterTabActive]}
      onPress={() => handleFilterPress(value)}
    >
      <Text style={[styles.filterTabText, activeFilter === value && styles.filterTabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderShipmentCard = ({ item }: { item: ShipmentCardItem }) => (
    <TouchableOpacity
      style={styles.shipmentCard}
      onPress={() => handleShipmentPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.trackingSection}>
          <Text style={styles.trackingLabel}>Order #{item.trackingNumber}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{item.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <View style={styles.addressContainer}>
          <Text style={styles.addressIcon}>📍</Text>
          <Text style={styles.address}>{truncateAddress(item.address)}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.timeSlotLabel}>⏱ {item.timeSlot || item.eta}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No Shipments Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'Try adjusting your search' : 'You have no deliveries assigned for today'}
      </Text>
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
          <ActivityIndicator size="large" color="#3b82f6" />
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

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, order #, or address..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={handleSearchChange}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {renderFilterTab('All', 'all')}
        {renderFilterTab('Pending', 'pending')}
        {renderFilterTab('In Transit', 'in_transit')}
        {renderFilterTab('Delivered', 'delivered')}
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>
            {stats.pending}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>
            {stats.delivered}
          </Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>
            {stats.failed}
          </Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* Shipments List */}
      <FlatList
        data={filteredShipments}
        keyExtractor={(item) => item.id}
        renderItem={renderShipmentCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        scrollEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#1a2332',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1a2332',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#1a2332',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 6,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  statsBar: {
    backgroundColor: '#1a2332',
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexGrow: 1,
  },
  shipmentCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  trackingSection: {
    flex: 1,
  },
  trackingLabel: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  address: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 16,
    flex: 1,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#2d3748',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  timeSlotLabel: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '600',
  },
  chevron: {
    fontSize: 18,
    color: '#64748b',
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
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
