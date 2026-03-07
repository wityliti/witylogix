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
}

interface RouteDetail {
  id: string;
  name: string;
  status: string;
  stops: Stop[];
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

  const handleNavigate = (latitude: number, longitude: number) => {
    const url = `maps://app?saddr=&daddr=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps application');
    });
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
        <Text style={styles.stopAddress}>{item.address}</Text>
        <View style={styles.stopStatus}>
          <View style={[styles.statusIndicator, getStatusColor(item.status)]} />
          <Text style={styles.statusLabel}>{item.status}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => handleNavigate(item.latitude, item.longitude)}
      >
        <Text style={styles.navButtonText}>Navigate</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#005bd3" />
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
        <View style={styles.header}>
          <Text style={styles.routeName}>{routeDetail.name}</Text>
          <View style={[styles.statusBadge, getStatusBgColor(routeDetail.status)]}>
            <Text style={styles.statusText}>{routeDetail.status}</Text>
          </View>
        </View>

        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>Map View (Integration Ready)</Text>
          <Text style={styles.mapSubtext}>{routeDetail.stops.length} stops on this route</Text>
        </View>

        <View style={styles.stopsContainer}>
          <Text style={styles.sectionTitle}>Stops</Text>
          <FlatList
            data={routeDetail.stops}
            keyExtractor={(item) => item.id}
            renderItem={renderStop}
            scrollEnabled={false}
          />
        </View>

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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return { backgroundColor: '#008060' };
    case 'in_progress':
      return { backgroundColor: '#005bd3' };
    default:
      return { backgroundColor: '#999' };
  }
};

const getStatusBgColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return { backgroundColor: '#e8f5e9' };
    case 'in_progress':
      return { backgroundColor: '#e3f2fd' };
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
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  routeName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#202223',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#005bd3',
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
    marginBottom: 4,
  },
  mapSubtext: {
    fontSize: 14,
    color: '#666',
  },
  stopsContainer: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202223',
    marginBottom: 12,
  },
  stopItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stopNumber: {
    width: 40,
    height: 40,
    backgroundColor: '#005bd3',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stopNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202223',
    marginBottom: 2,
  },
  stopAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  stopStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
  },
  navButton: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  navButtonText: {
    color: '#005bd3',
    fontSize: 12,
    fontWeight: '600',
  },
  actionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  primaryButton: {
    backgroundColor: '#005bd3',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
});

export default RouteDetailScreen;
