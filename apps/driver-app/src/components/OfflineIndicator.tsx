import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useOfflineSync } from '../hooks/useOfflineSync';

/**
 * Renders:
 *   • Amber banner  — offline, saving locally
 *   • Blue banner   — syncing X events
 *   • Green toast   — all data synced (auto-dismisses after 3 s)
 */
const OfflineIndicator: React.FC = () => {
  const { isOnline, syncStatus, pendingCount } = useOfflineSync();
  const [showSyncedToast, setShowSyncedToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const prevSyncStatus = useRef(syncStatus);

  // Show green toast when sync transitions to 'done'
  useEffect(() => {
    if (prevSyncStatus.current === 'syncing' && syncStatus === 'done' && pendingCount === 0) {
      setShowSyncedToast(true);
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setShowSyncedToast(false));
    }
    prevSyncStatus.current = syncStatus;
  }, [syncStatus, pendingCount, toastOpacity]);

  const isSyncing = syncStatus === 'syncing' && pendingCount > 0;
  const isOffline = !isOnline;

  if (!isOffline && !isSyncing && !showSyncedToast) {
    return null;
  }

  return (
    <>
      {isOffline && (
        <View style={styles.amberBanner}>
          <Text style={styles.bannerText}>
            You are offline — deliveries are being saved locally
          </Text>
        </View>
      )}

      {!isOffline && isSyncing && (
        <View style={styles.blueBanner}>
          <Text style={styles.bannerText}>
            Syncing {pendingCount} event{pendingCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {showSyncedToast && (
        <Animated.View style={[styles.greenToast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>All data synced</Text>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  amberBanner: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  blueBanner: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  greenToast: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OfflineIndicator;
