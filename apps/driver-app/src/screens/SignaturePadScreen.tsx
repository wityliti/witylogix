import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  Alert,
} from 'react-native';
import SvgImpl, { Path as PathImpl } from 'react-native-svg';

// react-native-svg v15 has a `refs` mismatch with React 18 class types
const Svg = SvgImpl as unknown as React.ComponentType<any>;
const Path = PathImpl as unknown as React.ComponentType<any>;
import { useNavigation, useRoute } from '@react-navigation/native';

const PAD_HEIGHT = 220;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD_WIDTH = SCREEN_WIDTH - 32; // 16px margin each side

export const SignaturePadScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { shipmentId, photoBase64 } = route.params as {
    shipmentId: string;
    photoBase64?: string;
  };

  const [completedPaths, setCompletedPaths] = useState<string[]>([]);
  const currentPathRef = useRef('');
  const [, forceRender] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPathRef.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        forceRender((n) => n + 1);
      },

      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPathRef.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        forceRender((n) => n + 1);
      },

      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          setCompletedPaths((prev) => [...prev, currentPathRef.current]);
          currentPathRef.current = '';
        }
      },
    }),
  ).current;

  const handleClear = () => {
    setCompletedPaths([]);
    currentPathRef.current = '';
    forceRender((n) => n + 1);
  };

  const handleConfirm = () => {
    if (completedPaths.length === 0) {
      Alert.alert('No Signature', 'Please draw a signature before confirming.');
      return;
    }

    const pathElements = completedPaths
      .map((d) => `<path d="${d}" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('');

    const svgXml = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${PAD_WIDTH}" height="${PAD_HEIGHT}">`,
      `<rect width="${PAD_WIDTH}" height="${PAD_HEIGHT}" fill="white"/>`,
      pathElements,
      '</svg>',
    ].join('');

    // Encode SVG as a base64 data URI
    const signatureBase64 = `data:image/svg+xml;base64,${btoa(svgXml)}`;

    navigation.navigate('DeliveryProof', { shipmentId, photoBase64, signatureBase64 });
  };

  const allPaths = completedPaths.concat(
    currentPathRef.current ? [currentPathRef.current] : [],
  );
  const hasStrokes = completedPaths.length > 0 || currentPathRef.current.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recipient Signature</Text>
        <Text style={styles.headerSubtitle}>Ask the recipient to sign in the box below</Text>
      </View>

      <View style={styles.padContainer}>
        <Text style={styles.padLabel}>Sign here</Text>
        <View style={styles.padWrapper} {...panResponder.panHandlers}>
          <Svg width={PAD_WIDTH} height={PAD_HEIGHT} style={styles.svg}>
            {allPaths.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke="#1e293b"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
          {!hasStrokes && (
            <View style={styles.placeholderOverlay} pointerEvents="none">
              <Text style={styles.placeholderText}>Draw signature here</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear} disabled={!hasStrokes}>
          <Text style={[styles.clearButtonText, !hasStrokes && styles.disabledText]}>
            Clear
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, !hasStrokes && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!hasStrokes}
        >
          <Text style={styles.confirmButtonText}>Confirm Signature</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cancelRow} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  padContainer: {
    marginTop: 8,
  },
  padLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  padWrapper: {
    width: PAD_WIDTH,
    height: PAD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    overflow: 'hidden',
    position: 'relative',
  },
  svg: {
    backgroundColor: '#fff',
  },
  placeholderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#2d3748',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  clearButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#475569',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledText: {
    color: '#64748b',
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  cancelText: {
    color: '#64748b',
    fontSize: 14,
  },
});
