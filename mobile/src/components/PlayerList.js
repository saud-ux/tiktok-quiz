import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

function PlayerRow({ player, isMe }) {
  return (
    <View style={[styles.row, isMe && styles.meRow]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{player.avatar || player.name?.[0] || '?'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {player.name}{isMe ? ' (أنت)' : ''}
        </Text>
        <Text style={styles.points}>{player.points || 0} نقطة</Text>
      </View>
      {player.streak > 0 && (
        <View style={styles.streak}>
          <Text style={styles.streakText}>{player.streak}x</Text>
        </View>
      )}
    </View>
  );
}

export default function PlayerList({ players, myId }) {
  const list = Object.values(players).sort((a, b) => (b.points || 0) - (a.points || 0));

  return (
    <FlatList
      data={list}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PlayerRow player={item} isMe={item.id === myId} />}
      style={styles.list}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  meRow: {
    borderColor: COLORS.green,
    backgroundColor: '#0c2a0c',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarText: {
    fontSize: 16,
  },
  info: {
    flex: 1,
    alignItems: 'flex-end',
  },
  name: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  points: {
    color: COLORS.muted,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  streak: {
    backgroundColor: COLORS.gold + '30',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 8,
  },
  streakText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
  },
});
