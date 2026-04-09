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
  Switch,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { useOfflineSync } from '../hooks/useOfflineSync';

interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
  };
  todayStats: {
    deliveriesCompleted: number;
    totalDistance: number;
    totalTime: number;
  };
}

const ProfileScreen: React.FC = () => {
  const { logout, user } = useAuth();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { lastSyncAt, pendingCount } = useOfflineSync();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const data = await api.get('/api/v4/drivers/me/profile');
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            Alert.alert('Error', 'Failed to logout');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#005bd3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{profile?.name || user?.name}</Text>
          <Text style={styles.email}>{profile?.email || user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{profile?.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile?.email}</Text>
          </View>
        </View>

        {profile?.vehicle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Vehicle</Text>
              <Text style={styles.value}>
                {profile.vehicle.make} {profile.vehicle.model}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>License Plate</Text>
              <Text style={styles.value}>{profile.vehicle.licensePlate}</Text>
            </View>
          </View>
        )}

        {profile?.todayStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{profile.todayStats.deliveriesCompleted}</Text>
                <Text style={styles.statLabel}>Deliveries</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {Math.round(profile.todayStats.totalDistance)}km
                </Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {Math.floor(profile.todayStats.totalTime / 60)}h
                </Text>
                <Text style={styles.statLabel}>Time</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>Receive delivery updates</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#ddd', true: '#81c784' }}
              thumbColor={notificationsEnabled ? '#008060' : '#999'}
            />
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Last Synced</Text>
              <Text style={styles.settingDescription}>
                {lastSyncAt
                  ? new Date(lastSyncAt).toLocaleString()
                  : 'Not yet synced this session'}
              </Text>
            </View>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 80,
    height: 80,
    backgroundColor: '#005bd3',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202223',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#202223',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#005bd3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202223',
  },
  settingDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  actionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#202223',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
