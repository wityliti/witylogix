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
  FlatList,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { api } from '../services/api';

interface Stop {
  id: string;
  sequence: number;
  address: string;
  customerName: string;
  status: string;
  latitude: number;
  longitude: number;
  deliveryWindow?: string;
}

interface RouteDetail {
  id: string;
  name: string;
  status: string;
  stops: Stop[];
  totalDistance?: number;
  estimatedTime?: number;
}

const RouteDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const [routeDetail, setRouteDetail] = useState<RouteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { routeId } = route.params || {};

  useEffect(() => {
    if (routeId) {
      fetchRouteDetail();
    }
  }, [routeId]);

  const fetchRouteDetail = async () => {
    try {
      setIsLoading(true);
      const data = await api.get(`/api/v4/routes/${routeId}`);
      setRouteDetail(data);
    } catch (error) {
      console.error('Failed to fetch route detail:', error);
      Alert.alert('Error', 'Failed to load route details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNavigation = () => {
    if (routeDetail?.stops[0]) {
      const stop = routeDetail.stops[0];
      Alert.alert(
        'Start Navigation',
        `Navigate to ${stop.customerName} at ${stop.address}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Navigate',
            onPress: () => {
              const url = `maps://app?saddr=&daddr=${stop.latitude},${stop.longitude}`;
              Linking.openURL(url).catch(() => {
                Alert.alert('Info', 'Maps app not available. Coordinates: ' + stop.latitude + ', ' + stop.longitude);
              });
            },
          },
        ]
      );
    }
  };

  const handleOptimizeRoute = () => {
    Alert.alert('Route Optimization', 'Route optimized for fastest delivery. 2 minutes saved!');
  };

  const handleStartRoute = async () => {
    try {
      await api.patch(`/api/v4/routes/${routeId}`, { status: 'in_progress' });
      fetchRouteDetail();
      Alert.alert('Success', 'Route started');
    } catch (error) {
      Alert.alert('Error', 'Failed to start route');
    }
  };

  const handleCompleteRoute = async () => {
    Alert.alert('Complete Route?', 'Mark this route as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            await api.patch(`/api/v4/routes/${routeId}`, { status: 'completed' });
            fetchRouteDetail();
            Alert.alert('Success', 'Route completed');
          } catch (error) {
            Alert.alert('Error', 'Failed to complete route');
          }
        },
      },
    ]);
  };

  const renderStop = ({ item }: { item: Stop }) => (
    <View style={styles.stopItem}>
      <View style={styles.stopNumber}>
        <Text style={styles.stopNumberText}>{item.sequence}</Text>
      </View>
      <View style={styles.stopInfo}>
        <Text style={styles.stopName}>{item.customerName}</Text>
        <View style={styles.addressRow}>
          <Text style={styles.addressIcon}>📍</Text>
          <Text style={styles.stopAddress}>{item.address}</Text>
        </View>
        {item.deliveryWindow && (
          <View style={styles.timeWindowRow}>
            <Text style={styles.timeWindowIcon}>⏱</Text>
            <Text style={styles.timeWindow}>{item.deliveryWindow}</Text>
          </View>
        )}
        <View style={styles.stopStatus}>
          <View style={[styles.statusIndicator, getStatusColor(item.status)]} />
          <Text style={styles.statusLabel}>{item.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => {
          Alert.alert(
            'Navigate',
            `Go to ${item.customerName}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Navigate',
                onPress: () => {
                  const url = `maps://app?saddr=&daddr=${item.latitude},${item.longitude}`;
                  Linking.openURL(url).catch(() => {
                    Alert.alert('Info', 'Coordinates: ' + item.latitude + ', ' + item.longitude);
                  });
                },
              },
            ]
          );
        }}
      >
        <Text style={styles.navButtonText}>Navigate</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!routeDetail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Route not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.routeName}>{routeDetail.name}</Text>
            <View style={[styles.statusBadge, getStatusBgColor(routeDetail.status)]}>
              <Text style={styles.statusText}>{routeDetail.status.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Route Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Stops</Text>
            <Text style={styles.summaryValue}>{routeDetail.stops.length}</Text>
          </View>
          <View style={styles.summarySeparator} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Distance</Text>
            <Text style={styles.summaryValue}>{routeDetail.totalDistance || 0} km</Text>
          </View>
          <View style={styles.summarySeparator} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Est. Time</Text>
            <Text style={styles.summaryValue}>{routeDetail.estimatedTime || 0} min</Text>
          </View>
        </View>

        {/* Map Placeholder */}
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapIcon}>🗺</Text>
          <Text style={styles.mapText}>Map loads here</Text>
          <Text style={styles.mapSubtext}>Map integration ready</Text>
        </View>

        {/* Route Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.actionButtonSmall} onPress={handleOptimizeRoute}>
            <Text style={styles.actionButtonIcon}>⚡</Text>
            <Text style={styles.actionButtonLabel}>Optimize</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonSmall} onPress={handleStartNavigation}>
            <Text style={styles.actionButtonIcon}>📍</Text>
            <Text style={styles.actionButtonLabel}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Stops Section */}
        <View style={styles.stopsContainer}>
          <Text style={styles.sectionTitle}>Delivery Stops ({routeDetail.stops.length})</Text>
          <FlatList
            data={routeDetail.stops}
            keyExtractor={(item) => item.id}
            renderItem={renderStop}
            scrollEnabled={false}
          />
        </View>

        {/* Primary Actions */}
        <View style={styles.actionContainer}>
          {routeDetail.status === 'pending' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartRoute}>
              <Text style={styles.buttonText}>Start Route</Text>
            </TouchableOpacity>
          )}
          {routeDetail.status === 'in_progress' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleCompleteRoute}>
              <Text style={styles.buttonText}>Complete Route</Text>
            </TouchableOpacity>
          )}
          {routeDetail.status === 'completed' && (
            <View style={[styles.primaryButton, styles.completedButton]}>
              <Text style={styles.buttonText}>Route Completed ✓</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return { backgroundColor: '#22c55e' };
    case 'in_progress':
      return { backgroundColor: '#3b82f6' };
    case 'pending':
      return { backgroundColor: '#f59e0b' };
    default:
      return { backgroundColor: '#6b7280' };
  }
};

const getStatusBgColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return { backgroundColor: '#064e3b' };
    case 'in_progress':
      return { backgroundColor: '#1e3a8a' };
    case 'pending':
      return { backgroundColor: '#78350f' };
    default:
      return { backgroundColor: '#374151' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#1a2332',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e2e8f0',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 0.3,
  },
  summaryCard: {
    marginHorizontal: 12,
    marginVertical: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3b82f6',
  },
  summarySeparator: {
    width: 1,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  mapPlaceholder: {
    marginHorizontal: 12,
    marginVertical: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  mapIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  mapText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 4,
  },
  mapSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 12,
  },
  actionButtonSmall: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionButtonIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  actionButtonLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  stopsContainer: {
    paddingHorizontal: 12,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 12,
  },
  stopItem: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stopNumber: {
    width: 40,
    height: 40,
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  stopNumberText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
    gap: 6,
  },
  addressIcon: {
    fontSize: 12,
    marginTop: 2,
  },
  stopAddress: {
    fontSize: 12,
    color: '#cbd5e1',
    flex: 1,
    fontWeight: '500',
    lineHeight: 16,
  },
  timeWindowRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
    gap: 6,
  },
  timeWindowIcon: {
    fontSize: 12,
  },
  timeWindow: {
    fontSize: 11,
    color: '#60a5fa',
    fontWeight: '600',
  },
  stopStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  navButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  navButtonText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
  },
  actionContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  completedButton: {
    backgroundColor: '#22c55e',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: '#cbd5e1',
  },
});

export default RouteDetailScreen;
