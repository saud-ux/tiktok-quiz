import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function ReverseOffer() {
  const { state, actions } = useGame();
  if (!state.reverseOffer) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔄</Text>
      <Text style={styles.title}>
        {state.reverseOffer.attackerName} يهاجمك!
      </Text>
      <Text style={styles.sub}>هل تريد عكس الهجوم؟ ({state.reverseOffer.secsLeft}s)</Text>
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.yesBtn} onPress={() => actions.reverseDecision(true)}>
          <Text style={styles.btnText}>اعكس!</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.noBtn} onPress={() => actions.reverseDecision(false)}>
          <Text style={styles.btnText}>تخطي</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '30%',
    left: 20,
    right: 20,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.gold,
    zIndex: 95,
  },
  icon: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  sub: {
    color: COLORS.muted,
    fontSize: 13,
    marginVertical: 10,
    writingDirection: 'rtl',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  yesBtn: {
    flex: 1,
    backgroundColor: COLORS.green,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  noBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
