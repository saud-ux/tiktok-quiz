import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGame } from '../GameContext';

export default function FrozenOverlay() {
  const { state, actions } = useGame();
  if (!state.showFrozen) return null;

  return (
    <View style={styles.overlay}>
      <Text style={styles.icon}>❄️</Text>
      <Text style={styles.title}>تم تجميدك!</Text>
      <Text style={styles.subtitle}>اضغط بسرعة لكسر الجليد</Text>
      <TouchableOpacity style={styles.tap} onPress={() => actions.breakIce()} activeOpacity={0.6}>
        <Text style={styles.tapText}>{state.frozenClicksLeft}</Text>
        <Text style={styles.tapLabel}>ضغطة متبقية</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59, 130, 246, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  icon: {
    fontSize: 60,
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: '#dbeafe',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
    writingDirection: 'rtl',
  },
  tap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  tapText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
  },
  tapLabel: {
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '600',
  },
});
