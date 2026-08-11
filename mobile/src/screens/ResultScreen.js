import React from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet } from 'react-native';
import { COLORS, LETTERS } from '../constants/theme';
import { useGame } from '../GameContext';

function LeaderboardRow({ entry, rank, isMe }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <View style={[styles.lbRow, isMe && styles.lbRowMe]}>
      <Text style={styles.lbRank}>{medals[rank] || `#${rank + 1}`}</Text>
      <Text style={styles.lbName} numberOfLines={1}>{entry.name}</Text>
      <View style={styles.lbRight}>
        <Text style={styles.lbPoints}>{entry.points}</Text>
        {entry.streak > 0 && <Text style={styles.lbStreak}>{entry.streak}x</Text>}
      </View>
    </View>
  );
}

export default function ResultScreen() {
  const { state } = useGame();
  const result = state.lastResult;
  if (!result) return null;

  const correctIdx = result.correctAnswer;
  const lb = state.lbReveal || state.lastLeaderboard || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>نتيجة السؤال</Text>

      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{result.question || state.currentQ?.text || ''}</Text>
      </View>

      {result.options && (
        <View style={styles.options}>
          {result.options.map((opt, i) => (
            <View
              key={i}
              style={[
                styles.option,
                i === correctIdx && styles.correctOpt,
                i !== correctIdx && styles.wrongOpt,
              ]}
            >
              <Text style={styles.optLetter}>{LETTERS[i] || ''}</Text>
              <Text style={styles.optText}>{opt}</Text>
              <Text style={styles.optMark}>{i === correctIdx ? '✅' : '❌'}</Text>
            </View>
          ))}
        </View>
      )}

      {result.correctText && !result.options && (
        <View style={[styles.option, styles.correctOpt, { marginBottom: 16 }]}>
          <Text style={styles.optText}>الإجابة: {result.correctText}</Text>
          <Text style={styles.optMark}>✅</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        {result.pointsEarned !== undefined && (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>النقاط</Text>
            <Text style={[styles.statValue, { color: result.pointsEarned > 0 ? COLORS.green : COLORS.red }]}>
              {result.pointsEarned > 0 ? '+' : ''}{result.pointsEarned}
            </Text>
          </View>
        )}
        {result.answeredCount !== undefined && (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>أجابوا</Text>
            <Text style={styles.statValue}>{result.answeredCount}/{result.totalPlayers || '?'}</Text>
          </View>
        )}
        {result.correctCount !== undefined && (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>صح</Text>
            <Text style={[styles.statValue, { color: COLORS.green }]}>{result.correctCount}</Text>
          </View>
        )}
      </View>

      {lb.length > 0 && (
        <View style={styles.leaderboard}>
          <Text style={styles.lbTitle}>الترتيب</Text>
          {lb.map((entry, i) => (
            <LeaderboardRow
              key={entry.id || i}
              entry={entry}
              rank={i}
              isMe={entry.id === state.myId}
            />
          ))}
        </View>
      )}
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
    paddingBottom: 40,
  },
  title: {
    color: COLORS.green,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
  },
  questionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  questionText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 24,
  },
  options: {
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
    marginBottom: 6,
  },
  correctOpt: {
    backgroundColor: '#166534',
    borderColor: '#22c55e',
  },
  wrongOpt: {
    backgroundColor: '#7f1d1d40',
    borderColor: '#ef444460',
  },
  optLetter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
    width: 20,
  },
  optText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  optMark: {
    fontSize: 16,
    marginRight: 8,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
  },
  leaderboard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    paddingVertical: 8,
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
  lbRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lbPoints: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  lbStreak: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
  },
});
