import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';
import PlayerList from '../components/PlayerList';

export default function LobbyScreen() {
  const { state } = useGame();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const playerCount = Object.keys(state.allPlayers).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>غرفة الانتظار</Text>
        <Animated.Text style={[styles.waiting, { opacity: pulse }]}>
          بانتظار بدء اللعبة من الهوست...
        </Animated.Text>
      </View>

      <View style={styles.myCard}>
        <View style={styles.myInfo}>
          <Text style={styles.myName}>{state.myName}</Text>
          <Text style={styles.myPoints}>{state.myPoints} نقطة</Text>
        </View>
        <View style={styles.myAbilities}>
          <Text style={styles.myAbLabel}>خصائصك:</Text>
          <Text style={styles.myAbTypes}>
            {state.myAbilities.attack} | {state.myAbilities.defense} | {state.myAbilities.general}
          </Text>
        </View>
      </View>

      <View style={styles.playersHeader}>
        <Text style={styles.playersTitle}>اللاعبون</Text>
        <Text style={styles.playerCount}>{playerCount}</Text>
      </View>

      <PlayerList players={state.allPlayers} myId={state.myId} />

      {!state.connected && (
        <View style={styles.disconnected}>
          <Text style={styles.disconnectedText}>انقطع الاتصال - جاري إعادة المحاولة...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: COLORS.green,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  waiting: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  myCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.green,
    marginBottom: 20,
  },
  myInfo: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  myName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
  myPoints: {
    color: COLORS.green,
    fontSize: 15,
    fontWeight: '700',
  },
  myAbilities: {
    flexDirection: 'row-reverse',
    gap: 6,
    alignItems: 'center',
  },
  myAbLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  myAbTypes: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  playersHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  playersTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  playerCount: {
    color: COLORS.green,
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  disconnected: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: COLORS.red + '30',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  disconnectedText: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
});
