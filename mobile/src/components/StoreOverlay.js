import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function StoreOverlay() {
  const { state, actions } = useGame();
  if (!state.showStore) return null;

  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>المتجر</Text>
            <Text style={styles.points}>{state.myPoints} نقطة</Text>
          </View>
          <FlatList
            data={state.storeItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const purchased = state.storePurchased[item.id];
              const canAfford = state.myPoints >= item.cost;
              return (
                <View style={styles.item}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                    <View style={styles.itemText}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemDesc}>{item.desc}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.buyBtn,
                      purchased && styles.bought,
                      !canAfford && !purchased && styles.cantAfford,
                    ]}
                    disabled={purchased || !canAfford}
                    onPress={() => actions.buyStoreItem(item.id)}
                  >
                    <Text style={styles.buyText}>
                      {purchased ? 'تم' : `${item.cost}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
            style={styles.list}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: '900',
  },
  points: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  list: {
    maxHeight: 300,
  },
  item: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  itemIcon: {
    fontSize: 24,
    marginLeft: 10,
  },
  itemText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  itemDesc: {
    color: COLORS.muted,
    fontSize: 11,
    writingDirection: 'rtl',
  },
  buyBtn: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  bought: {
    backgroundColor: COLORS.border,
  },
  cantAfford: {
    backgroundColor: COLORS.red + '50',
  },
  buyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
