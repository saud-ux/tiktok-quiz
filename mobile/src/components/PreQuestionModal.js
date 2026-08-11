import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { ABILITIES, ABILITY_CAT_MAP } from '../constants/abilities';
import { useGame } from '../GameContext';

export default function PreQuestionModal() {
  const { state, actions } = useGame();
  if (!state.showPreQ) return null;

  const available = state.preQAbilities.filter(ab => {
    const cat = ABILITY_CAT_MAP[ab];
    return cat && !state.abilitiesState[cat];
  });

  const needsTarget = (type) => ['hole', 'freeze', 'cut', 'blur', 'spy'].includes(type);

  const handleUse = (type) => {
    const cat = ABILITY_CAT_MAP[type];
    if (needsTarget(type)) {
      actions.set({
        showTargetModal: true,
        targetModalTitle: `اختر هدف ${ABILITIES[cat]?.find(a => a.type === type)?.name || ''}`,
        targetModalCallback: (targetId) => {
          actions.preQuestionDecision(true, cat, type, targetId);
        },
      });
    } else {
      actions.preQuestionDecision(true, cat, type);
    }
  };

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>هل تريد استخدام خاصية قبل السؤال؟</Text>
          {available.map(type => {
            const cat = ABILITY_CAT_MAP[type];
            const ab = ABILITIES[cat]?.find(a => a.type === type);
            if (!ab) return null;
            return (
              <TouchableOpacity key={type} style={styles.abilityBtn} onPress={() => handleUse(type)}>
                <Text style={styles.abilityIcon}>{ab.icon}</Text>
                <View style={styles.abilityInfo}>
                  <Text style={styles.abilityName}>{ab.name}</Text>
                  <Text style={styles.abilityDesc}>{ab.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.skip}
            onPress={() => actions.preQuestionDecision(false)}
          >
            <Text style={styles.skipText}>تخطي</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    writingDirection: 'rtl',
  },
  abilityBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  abilityIcon: {
    fontSize: 24,
    marginLeft: 10,
  },
  abilityInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  abilityName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  abilityDesc: {
    color: COLORS.muted,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  skip: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
  },
  skipText: {
    color: COLORS.muted,
    fontSize: 15,
    fontWeight: '700',
  },
});
