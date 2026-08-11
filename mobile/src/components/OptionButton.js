import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { COLORS, LETTERS, OPT_COLORS } from '../constants/theme';

export default function OptionButton({ index, text, onPress, selected, correct, wrong, eliminated, disabled, showResult }) {
  const letter = LETTERS[index] || '';
  const borderColor = OPT_COLORS[index]?.border || COLORS.border;

  let bg = COLORS.card;
  let extraBorder = borderColor;
  if (showResult && correct) {
    bg = '#166534';
    extraBorder = '#22c55e';
  } else if (showResult && wrong) {
    bg = '#7f1d1d';
    extraBorder = '#ef4444';
  } else if (selected) {
    bg = '#1e3a5f';
    extraBorder = '#3b82f6';
  }

  if (eliminated) {
    return (
      <View style={[styles.container, styles.eliminated]}>
        <Text style={styles.eliminatedText}>--</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: bg, borderColor: extraBorder }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.letter, { backgroundColor: borderColor + '30' }]}>
        <Text style={[styles.letterText, { color: borderColor }]}>{letter}</Text>
      </View>
      <Text style={styles.text} numberOfLines={2}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  letter: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  letterText: {
    fontSize: 16,
    fontWeight: '800',
  },
  text: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  eliminated: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    opacity: 0.4,
  },
  eliminatedText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 16,
    textAlign: 'center',
  },
});
