import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function AbilityCard({ ability, selected, onPress, compact }) {
  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compact, selected && styles.compactSelected]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.icon}>{ability.icon}</Text>
        <Text style={styles.compactName}>{ability.name}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.selected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.iconLarge}>{ability.icon}</Text>
      <Text style={styles.name}>{ability.name}</Text>
      <Text style={styles.desc}>{ability.desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  selected: {
    borderColor: COLORS.green,
    backgroundColor: '#0c2a0c',
  },
  iconLarge: {
    fontSize: 28,
    marginBottom: 6,
  },
  name: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  desc: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 16,
  },
  compact: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  compactSelected: {
    borderColor: COLORS.green,
    backgroundColor: '#0c2a0c',
  },
  icon: {
    fontSize: 18,
  },
  compactName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
