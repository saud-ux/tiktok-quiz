import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

function PodiumSlot({ player, rank, delay }) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const medals = ['🥇', '🥈', '🥉'];
  const heights = [120, 90, 70];
  const colors = ['#f59e0b', '#94a3b8', '#cd7f32'];

  if (!player) return <View style={styles.podiumEmpty} />;

  return (
    <Animated.View style={[styles.podiumSlot, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.podiumMedal}>{medals[rank]}</Text>
      <Text style={styles.podiumName} numberOfLines={1}>{player.name}</Text>
      <Text style={styles.podiumPoints}>{player.points}</Text>
      <View style={[styles.podiumBar, { height: heights[rank], backgroundColor: colors[rank] + '40', borderColor: colors[rank] }]}>
        <Text style={[styles.podiumRank, { color: colors[rank] }]}>#{rank + 1}</Text>
      </View>
    </Animated.View>
  );
}

export default function FinalScreen() {
  const { state } = useGame();
  const data = state.finalData;
  if (!data) return null;

  const { top3, leaderboard: lb } = data;
  const podiumOrder = [top3?.[1], top3?.[0], top3?.[2]];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>انتهت اللعبة!</Text>
      <Text style={styles.subtitle}>النتائج النهائية</Text>

      <View style={styles.podium}>
        {podiumOrder.map((p, i) => {
          const ranks = [1, 0, 2];
          return (
            <PodiumSlot
              key={i}
              player={p}
              rank={ranks[i]}
              delay={ranks[i] === 0 ? 600 : ranks[i] === 1 ? 300 : 0}
            />
          );
        })}
      </View>

      {lb && lb.length > 0 && (
        <View style={styles.leaderboard}>
          <Text style={styles.lbTitle}>الترتيب الكامل</Text>
          {lb.map((entry, i) => {
            const isMe = entry.id === state.myId;
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <View key={entry.id || i} style={[styles.lbRow, isMe && styles.lbRowMe]}>
                <Text style={styles.lbRank}>{medals[i] || `#${i + 1}`}</Text>
                <Text style={styles.lbName} numberOfLines={1}>{entry.name}</Text>
                <Text style={styles.lbPoints}>{entry.points}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>شكراً على المشاركة!</Text>
        <Text style={styles.footerSub}>تابع البث لجولة جديدة</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  title: {
    color: COLORS.gold,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 30,
    height: 220,
    paddingHorizontal: 8,
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  podiumEmpty: {
    flex: 1,
  },
  podiumMedal: {
    fontSize: 32,
    marginBottom: 4,
  },
  podiumName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  podiumPoints: {
    color: COLORS.green,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  podiumBar: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumRank: {
    fontSize: 20,
    fontWeight: '900',
  },
  leaderboard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  lbTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  lbRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  lbRowMe: {
    backgroundColor: COLORS.green + '15',
    borderWidth: 1,
    borderColor: COLORS.green + '40',
  },
  lbRank: {
    fontSize: 16,
    width: 30,
    textAlign: 'center',
    marginLeft: 6,
  },
  lbName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  lbPoints: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    color: COLORS.green,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  footerSub: {
    color: COLORS.muted,
    fontSize: 13,
    writingDirection: 'rtl',
  },
});
