import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function TargetModal() {
  const { state, actions } = useGame();
  if (!state.showTargetModal) return null;

  const targets = Object.values(state.allPlayers).filter(p => p.id !== state.myId);

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>{state.targetModalTitle || 'اختر لاعب'}</Text>
          <FlatList
            data={targets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.item}
                onPress={() => {
                  state.targetModalCallback?.(item.id);
                  actions.set({ showTargetModal: false, targetModalCallback: null });
                }}
              >
                <Text style={styles.itemAvatar}>{item.avatar || item.name?.[0] || '?'}</Text>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPoints}>{item.points || 0}</Text>
              </TouchableOpacity>
            )}
            style={styles.list}
          />
          <TouchableOpacity
            style={styles.cancel}
            onPress={() => actions.set({ showTargetModal: false, targetModalCallback: null })}
          >
            <Text style={styles.cancelText}>إلغاء</Text>
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
    alignItems: 'center',
    padding: 30,
  },
  modal: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    writingDirection: 'rtl',
  },
  list: {
    maxHeight: 300,
  },
  item: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemAvatar: {
    fontSize: 20,
    marginLeft: 10,
  },
  itemName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  itemPoints: {
    color: COLORS.muted,
    fontSize: 13,
  },
  cancel: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
  },
  cancelText: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '700',
  },
});
