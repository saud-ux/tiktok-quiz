import React, { useState, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { COLORS, LETTERS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function RevealSequence() {
  const { state } = useGame();
  const [revealIndex, setRevealIndex] = useState(-1);

  useEffect(() => {
    if (!state.revealSequence) {
      setRevealIndex(-1);
      return;
    }
    const seq = state.revealSequence;
    let i = 0;
    const interval = setInterval(() => {
      if (i >= seq.length) {
        clearInterval(interval);
        return;
      }
      setRevealIndex(i);
      i++;
    }, 600);
    return () => clearInterval(interval);
  }, [state.revealSequence]);

  if (!state.revealSequence) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>كشف الإجابة...</Text>
      <View style={styles.options}>
        {state.revealSequence.map((item, idx) => {
          const revealed = idx <= revealIndex;
          const isCorrect = item.correct;
          return (
            <View
              key={idx}
              style={[
                styles.option,
                revealed && (isCorrect ? styles.correct : styles.wrong),
                !revealed && styles.hidden,
              ]}
            >
              <Text style={styles.letter}>{LETTERS[item.index] || ''}</Text>
              <Text style={styles.optText} numberOfLines={1}>{item.text}</Text>
              {revealed && (
                <Text style={styles.mark}>{isCorrect ? '✅' : '❌'}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 14, 5, 0.95)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 85,
  },
  title: {
    color: COLORS.gold,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 24,
  },
  options: {
    gap: 10,
  },
  option: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  hidden: {
    opacity: 0.3,
  },
  correct: {
    backgroundColor: '#166534',
    borderColor: '#22c55e',
    opacity: 1,
  },
  wrong: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
    opacity: 1,
  },
  letter: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
    width: 24,
  },
  optText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  mark: {
    fontSize: 18,
    marginRight: 8,
  },
});
