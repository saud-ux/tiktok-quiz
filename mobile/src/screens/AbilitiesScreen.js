import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { ABILITIES } from '../constants/abilities';
import AbilityCard from '../components/AbilityCard';
import { useGame } from '../GameContext';

export default function AbilitiesScreen({ playerName, playerAvatar }) {
  const { state, actions } = useGame();
  const [selected, setSelected] = useState({ attack: null, defense: null, general: null });

  const allSelected = selected.attack && selected.defense && selected.general;

  const handleConfirm = () => {
    if (!allSelected) {
      actions.toast('اختر خاصية من كل فئة', 'red');
      return;
    }
    actions.joinGame(
      state._joinName || 'لاعب',
      state._joinAvatar || null,
      selected,
    );
  };

  const categories = [
    { key: 'attack', label: 'هجوم', icon: '⚔️', color: '#ef4444' },
    { key: 'defense', label: 'دفاع', icon: '🛡️', color: '#3b82f6' },
    { key: 'general', label: 'عامة', icon: '✨', color: '#f59e0b' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>اختر خصائصك</Text>
        <Text style={styles.subtitle}>اختر خاصية واحدة من كل فئة</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {categories.map(cat => (
          <View key={cat.key} style={styles.category}>
            <View style={styles.catHeader}>
              <Text style={styles.catIcon}>{cat.icon}</Text>
              <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
            </View>
            <View style={styles.grid}>
              {ABILITIES[cat.key].map(ab => (
                <AbilityCard
                  key={ab.type}
                  ability={ab}
                  selected={selected[cat.key] === ab.type}
                  onPress={() => setSelected(prev => ({ ...prev, [cat.key]: ab.type }))}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => actions.goToScreen('join')}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, !allSelected && styles.confirmDisabled]}
          onPress={handleConfirm}
          disabled={!allSelected}
        >
          <Text style={styles.confirmText}>انضم للعبة</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    color: COLORS.green,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  category: {
    marginBottom: 20,
  },
  catHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  catIcon: {
    fontSize: 18,
  },
  catLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
  },
  footer: {
    flexDirection: 'row-reverse',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backText: {
    color: COLORS.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.green,
    alignItems: 'center',
  },
  confirmDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
});
