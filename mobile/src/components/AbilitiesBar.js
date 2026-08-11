import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { ABILITIES, ABILITY_CAT_MAP } from '../constants/abilities';
import { useGame } from '../GameContext';

export default function AbilitiesBar() {
  const { state, actions } = useGame();
  if (!state.questionActive) return null;

  const needsTarget = (type) => ['hole', 'freeze', 'cut', 'blur', 'spy'].includes(type);

  const handleAbility = (category) => {
    const type = state.myAbilities[category];
    if (!type || state.abilitiesState[category]) return;

    if (needsTarget(type)) {
      const ab = ABILITIES[category]?.find(a => a.type === type);
      actions.set({
        showTargetModal: true,
        targetModalTitle: `اختر هدف ${ab?.name || ''}`,
        targetModalCallback: (targetId) => {
          actions.useAbility(category, targetId);
        },
      });
    } else {
      actions.useAbility(category);
    }
  };

  const cats = ['attack', 'defense', 'general'];

  return (
    <View style={styles.container}>
      {cats.map(cat => {
        const type = state.myAbilities[cat];
        if (!type) return null;
        const ab = ABILITIES[cat]?.find(a => a.type === type);
        if (!ab) return null;
        const used = state.abilitiesState[cat];

        return (
          <TouchableOpacity
            key={cat}
            style={[styles.btn, used && styles.used]}
            disabled={used}
            onPress={() => handleAbility(cat)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{ab.icon}</Text>
            <Text style={[styles.name, used && styles.usedText]}>{ab.name}</Text>
          </TouchableOpacity>
        );
      })}

      {state.myBonusAbility && !state.myBonusAbility.used && (
        <TouchableOpacity style={[styles.btn, styles.bonus]} onPress={() => actions.useBonus()}>
          <Text style={styles.icon}>{state.myBonusAbility.icon}</Text>
          <Text style={styles.bonusName}>{state.myBonusAbility.name}</Text>
        </TouchableOpacity>
      )}

      {!state.jokerUsed && !state.hasAnswered && state.currentQ?.type === 'mcq' && (
        <TouchableOpacity style={[styles.btn, styles.joker]} onPress={() => actions.useJoker()}>
          <Text style={styles.icon}>🃏</Text>
          <Text style={styles.jokerName}>جوكر</Text>
        </TouchableOpacity>
      )}

      {state.retryAvailable && (
        <TouchableOpacity style={[styles.btn, styles.retry]} onPress={() => actions.useRetry()}>
          <Text style={styles.icon}>↩️</Text>
          <Text style={styles.retryName}>إعادة</Text>
        </TouchableOpacity>
      )}

      {state.revivalAvailable && (
        <TouchableOpacity style={[styles.btn, styles.revival]} onPress={() => actions.useRevival()}>
          <Text style={styles.icon}>✨</Text>
          <Text style={styles.revivalName}>إنعاش</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  btn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  used: {
    opacity: 0.35,
    backgroundColor: COLORS.surface,
  },
  icon: {
    fontSize: 16,
  },
  name: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  usedText: {
    color: COLORS.muted,
    textDecorationLine: 'line-through',
  },
  bonus: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.gold + '20',
  },
  bonusName: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  joker: {
    borderColor: '#a855f7',
    backgroundColor: '#a855f720',
  },
  jokerName: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '700',
  },
  retry: {
    borderColor: COLORS.cyan,
    backgroundColor: COLORS.cyan + '20',
  },
  retryName: {
    color: COLORS.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  revival: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.green + '20',
  },
  revivalName: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '700',
  },
});
