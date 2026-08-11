import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function OrderQuestion() {
  const { state, actions } = useGame();
  const [order, setOrder] = useState(state.orderArr || []);

  if (!state.currentQ || state.currentQ.type !== 'order') return null;

  const options = state.currentQ.options;

  const moveUp = (idx) => {
    if (idx === 0) return;
    const arr = [...order];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setOrder(arr);
  };

  const moveDown = (idx) => {
    if (idx >= order.length - 1) return;
    const arr = [...order];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setOrder(arr);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>رتّب من الأعلى للأسفل</Text>
      {order.map((optIdx, pos) => (
        <View key={optIdx} style={styles.item}>
          <Text style={styles.num}>{pos + 1}</Text>
          <Text style={styles.text} numberOfLines={2}>{options[optIdx]}</Text>
          <View style={styles.arrows}>
            <TouchableOpacity onPress={() => moveUp(pos)} disabled={pos === 0}>
              <Text style={[styles.arrow, pos === 0 && styles.arrowDisabled]}>▲</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => moveDown(pos)} disabled={pos >= order.length - 1}>
              <Text style={[styles.arrow, pos >= order.length - 1 && styles.arrowDisabled]}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {!state.hasAnswered && (
        <TouchableOpacity style={styles.submit} onPress={() => actions.submitOrderAnswer(order)}>
          <Text style={styles.submitText}>تأكيد الترتيب</Text>
        </TouchableOpacity>
      )}
      {state.hasAnswered && (
        <View style={styles.submitted}>
          <Text style={styles.submittedText}>تم إرسال ترتيبك ✅</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  hint: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
    writingDirection: 'rtl',
  },
  item: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  num: {
    color: COLORS.green,
    fontSize: 18,
    fontWeight: '900',
    width: 28,
    textAlign: 'center',
    marginLeft: 8,
  },
  text: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  arrows: {
    marginRight: 8,
    gap: 4,
  },
  arrow: {
    color: COLORS.green,
    fontSize: 16,
    padding: 4,
  },
  arrowDisabled: {
    color: COLORS.border,
  },
  submit: {
    backgroundColor: COLORS.green,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  submitted: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  submittedText: {
    color: COLORS.green,
    fontSize: 16,
    fontWeight: '700',
  },
});
