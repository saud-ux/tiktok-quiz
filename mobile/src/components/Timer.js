import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function Timer({ timeLeft, total }) {
  const pct = Math.max(0, (timeLeft / total) * 100);
  const barColor = timeLeft <= 5 ? COLORS.red : timeLeft <= 10 ? COLORS.gold : COLORS.green;

  return (
    <View style={styles.container}>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.label, timeLeft <= 5 && styles.urgent]}>{timeLeft}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  barBg: {
    flex: 1,
    height: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  label: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    width: 30,
    textAlign: 'center',
  },
  urgent: {
    color: COLORS.red,
  },
});
