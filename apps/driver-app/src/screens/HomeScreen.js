import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';
const HomeScreen = () => {
    const [stats, setStats] = useState(null);
    const [activeDelivery, setActiveDelivery] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigation = useNavigation();
    useEffect(() => {
        fetchTodayData();
    }, []);
    const fetchTodayData = async () => {
        try {
            setIsLoading(true);
            const [statsData, deliveryData] = await Promise.all([
                api.get('/api/v4/drivers/me/stats/today'),
                api.get('/api/v4/drivers/me/active-delivery'),
            ]);
            setStats(statsData);
            setActiveDelivery(deliveryData || null);
        }
        catch (error) {
            console.error('Failed to fetch today data:', error);
            Alert.alert('Error', 'Failed to load today\'s data');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleStartDelivery = async () => {
        if (activeDelivery) {
            navigation.navigate('Delivery', { deliveryId: activeDelivery.id });
        }
        else {
            Alert.alert('No Active Delivery', 'No delivery assigned at this time');
        }
    };
    if (isLoading) {
        return (<SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#005bd3"/>
        </View>
      </SafeAreaView>);
    }
    return (<SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Today's Summary</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.ordersRemaining || 0}</Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.completed || 0}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.successRate || 0}%</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>

        {activeDelivery && (<View style={styles.activeDeliveryCard}>
            <Text style={styles.cardTitle}>Active Delivery</Text>
            <View style={styles.cardContent}>
              <Text style={styles.customerName}>{activeDelivery.customerName}</Text>
              <Text style={styles.address}>{activeDelivery.address}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: '#008060' }]}>
                  <Text style={styles.statusText}>{activeDelivery.status}</Text>
                </View>
                <Text style={styles.eta}>ETA: {activeDelivery.eta}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.startButton} onPress={handleStartDelivery}>
              <Text style={styles.startButtonText}>Start Delivery</Text>
            </TouchableOpacity>
          </View>)}

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Break</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]}>
            <Text style={styles.actionButtonTextSecondary}>End Shift</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.refreshContainer}>
          <TouchableOpacity onPress={fetchTodayData}>
            <Text style={styles.refreshText}>Refresh Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>);
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
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#202223',
    },
    statsContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    statNumber: {
        fontSize: 28,
        fontWeight: '700',
        color: '#005bd3',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    activeDeliveryCard: {
        marginHorizontal: 16,
        marginVertical: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#202223',
        marginBottom: 12,
    },
    cardContent: {
        marginBottom: 16,
    },
    customerName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#202223',
        marginBottom: 4,
    },
    address: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
        lineHeight: 20,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    eta: {
        fontSize: 14,
        color: '#666',
    },
    startButton: {
        backgroundColor: '#005bd3',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    startButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    actionsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginVertical: 12,
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#005bd3',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    actionButtonSecondary: {
        backgroundColor: '#f0f0f0',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    actionButtonTextSecondary: {
        color: '#202223',
        fontSize: 14,
        fontWeight: '600',
    },
    refreshContainer: {
        paddingHorizontal: 16,
        marginVertical: 20,
    },
    refreshText: {
        color: '#005bd3',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
});
export default HomeScreen;
//# sourceMappingURL=HomeScreen.js.map