import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { useOfflineSync } from "../hooks/useOfflineSync";
import OfflineIndicator from "../components/OfflineIndicator";

interface DeliveryStats {
  ordersRemaining: number;
  completed: number;
  distanceCovered: number;
  avgDeliveryTime: number;
  earnings: number;
}

interface ActiveDelivery {
  id: string;
  customerName: string;
  address: string;
  status: string;
  eta: string;
}

const HomeScreen: React.FC = () => {
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<ActiveDelivery | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();
  const { pendingCount } = useOfflineSync();

  useFocusEffect(
    React.useCallback(() => {
      fetchTodayData();
    }, []),
  );

  const fetchTodayData = async () => {
    try {
      setIsLoading(true);
      const [statsData, deliveryData] = await Promise.all([
        api.get("/api/v4/drivers/me/stats/today"),
        api.get("/api/v4/drivers/me/active-delivery"),
      ]);
      setStats(statsData);
      setActiveDelivery(deliveryData || null);
    } catch (error) {
      console.error("Failed to fetch today data:", error);
      Alert.alert("Error", "Failed to load today's data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTodayData();
    setRefreshing(false);
  };

  const handleStartRoute = () => {
    if (activeDelivery) {
      navigation.navigate("Delivery", { deliveryId: activeDelivery.id });
    } else {
      Alert.alert("No Active Delivery", "No delivery assigned at this time");
    }
  };

  const handleViewSchedule = () => {
    navigation.navigate("Routes");
  };

  const handleScanPackage = () => {
    Alert.alert("Scan Package", "Package scanning feature coming soon");
  };

  if (isLoading && !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <OfflineIndicator />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <OfflineIndicator />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#3b82f6"]}
            tintColor="#3b82f6"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Today's Deliveries</Text>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerSubtitle}>Dashboard</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Completed</Text>
            <Text style={styles.statNumber}>{stats?.completed || 0}</Text>
            <Text style={styles.statSubtext}>
              of {(stats?.completed || 0) + (stats?.ordersRemaining || 0)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statNumber}>{stats?.distanceCovered || 0}</Text>
            <Text style={styles.statSubtext}>km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Avg Time</Text>
            <Text style={styles.statNumber}>{stats?.avgDeliveryTime || 0}</Text>
            <Text style={styles.statSubtext}>min</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Earnings</Text>
            <Text style={styles.statNumber}>${stats?.earnings || 0}</Text>
            <Text style={styles.statSubtext}>today</Text>
          </View>
        </View>

        {/* Active Delivery Card */}
        {activeDelivery && (
          <View style={styles.activeDeliveryCard}>
            <View style={styles.deliveryHeader}>
              <View>
                <Text style={styles.deliveryLabel}>Active Delivery</Text>
                <Text style={styles.deliveryCustomer}>
                  {activeDelivery.customerName}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  getStatusColor(activeDelivery.status),
                ]}
              >
                <Text style={styles.statusText}>{activeDelivery.status}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.deliveryContent}>
              <View style={styles.addressRow}>
                <Text style={styles.addressLabel}>📍 Address</Text>
                <Text style={styles.address}>{activeDelivery.address}</Text>
              </View>

              <View style={styles.etaRow}>
                <Text style={styles.etaLabel}>⏱ ETA: {activeDelivery.eta}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartRoute}
            >
              <Text style={styles.startButtonText}>Start Route</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleStartRoute}
            >
              <Text style={styles.actionIcon}>🚚</Text>
              <Text style={styles.actionText}>Start Route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleViewSchedule}
            >
              <Text style={styles.actionIcon}>📅</Text>
              <Text style={styles.actionText}>View Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleScanPackage}
            >
              <Text style={styles.actionIcon}>📦</Text>
              <Text style={styles.actionText}>Scan Package</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Empty State */}
        {!activeDelivery && (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No Active Deliveries</Text>
            <Text style={styles.emptySubtitle}>
              Check your schedule for upcoming deliveries
            </Text>
            <TouchableOpacity
              style={styles.viewScheduleButton}
              onPress={handleViewSchedule}
            >
              <Text style={styles.viewScheduleButtonText}>View Schedule</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.spacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "in_transit":
      return { backgroundColor: "#3b82f6" };
    case "out_for_delivery":
      return { backgroundColor: "#f59e0b" };
    case "pending":
      return { backgroundColor: "#6b7280" };
    default:
      return { backgroundColor: "#3b82f6" };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: "#1a2332",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 4,
  },
  pendingBadge: {
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  pendingBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "500",
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: "700",
    color: "#3b82f6",
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  activeDeliveryCard: {
    marginHorizontal: 12,
    marginVertical: 12,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    borderWidth: 1,
    borderColor: "#334155",
  },
  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  deliveryLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  deliveryCustomer: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
  },
  statusText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: "#334155",
    marginVertical: 12,
  },
  deliveryContent: {
    marginBottom: 14,
  },
  addressRow: {
    marginBottom: 10,
  },
  addressLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 20,
    fontWeight: "500",
  },
  etaRow: {
    marginTop: 8,
  },
  etaLabel: {
    fontSize: 13,
    color: "#60a5fa",
    fontWeight: "600",
  },
  startButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  startButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  actionsSection: {
    paddingHorizontal: 16,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: "#cbd5e1",
    fontWeight: "600",
    textAlign: "center",
  },
  emptyStateCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "500",
  },
  viewScheduleButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  viewScheduleButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  spacing: {
    height: 20,
  },
});

export default HomeScreen;
