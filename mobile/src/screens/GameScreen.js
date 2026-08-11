import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';
import Timer from '../components/Timer';
import OptionButton from '../components/OptionButton';
import AbilitiesBar from '../components/AbilitiesBar';
import OrderQuestion from '../components/OrderQuestion';
import TextQuestion from '../components/TextQuestion';
import FrozenOverlay from '../components/FrozenOverlay';
import AttackOverlay from '../components/AttackOverlay';
import RevealSequence from '../components/RevealSequence';
import ReverseOffer from '../components/ReverseOffer';
import StoreVoteOverlay from '../components/StoreVoteOverlay';
import NewLeaderBanner from '../components/NewLeaderBanner';
import LastQuestionBanner from '../components/LastQuestionBanner';

export default function GameScreen() {
  const { state, actions } = useGame();
  const q = state.currentQ;

  if (!q) return null;

  const handleAnswer = (index) => {
    if (state.hasAnswered && !state.hasUsedLastSecond && state.timeLeft > 0 && state.timeLeft <= 5) {
      actions.changeAnswer(index);
    } else if (!state.hasAnswered) {
      actions.submitAnswer(index);
    }
  };

  const getDisplayOptions = () => {
    if (!q.options) return [];
    if (state.shuffleMap) {
      return q.options.map((_, i) => {
        const mapped = Object.entries(state.shuffleMap).find(([k, v]) => parseInt(v) === i);
        const displayIdx = mapped ? parseInt(mapped[0]) : i;
        return { text: q.options[i], displayIndex: displayIdx, realIndex: i };
      });
    }
    return q.options.map((text, i) => ({ text, displayIndex: i, realIndex: i }));
  };

  const canLastSecond = state.hasAnswered && !state.hasUsedLastSecond && state.timeLeft > 0 && state.timeLeft <= 5;

  return (
    <View style={styles.container}>
      <FrozenOverlay />
      <RevealSequence />
      <AttackOverlay />
      <ReverseOffer />
      <StoreVoteOverlay />
      <NewLeaderBanner />
      <LastQuestionBanner />

      <View style={styles.topBar}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>نقاط</Text>
            <Text style={styles.statValue}>{state.myPoints}</Text>
          </View>
          {state.myStreak > 0 && (
            <View style={[styles.stat, styles.streakStat]}>
              <Text style={styles.statLabel}>ستريك</Text>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>{state.myStreak}x</Text>
            </View>
          )}
          {state.tripleBoost && (
            <View style={[styles.stat, styles.tripleStat]}>
              <Text style={styles.tripleText}>×3</Text>
            </View>
          )}
          {state.isLastQuestion && (
            <View style={[styles.stat, styles.lastQStat]}>
              <Text style={styles.lastQText}>السؤال الأخير</Text>
            </View>
          )}
        </View>
      </View>

      <Timer timeLeft={state.timeLeft} total={state.questionTime} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.question}>{q.text}</Text>

        <AbilitiesBar />

        {state.hintText && (
          <View style={styles.hint}>
            <Text style={styles.hintIcon}>💡</Text>
            <Text style={styles.hintText}>{state.hintText}</Text>
          </View>
        )}

        {q.type === 'mcq' && (
          <View style={styles.options}>
            {getDisplayOptions().map((opt, idx) => {
              const isEliminated = (state.eliminatedOptions || []).includes(opt.realIndex);
              const isSelected = state.myAnswer === opt.displayIndex;
              return (
                <OptionButton
                  key={idx}
                  index={idx}
                  text={opt.text}
                  selected={isSelected}
                  eliminated={isEliminated}
                  disabled={state.isCut || (!canLastSecond && state.hasAnswered) || isEliminated}
                  onPress={() => handleAnswer(opt.displayIndex)}
                />
              );
            })}
            {canLastSecond && (
              <Text style={styles.lastSecondHint}>⚡ آخر 5 ثواني - يمكنك تغيير إجابتك!</Text>
            )}
          </View>
        )}

        {q.type === 'order' && <OrderQuestion />}
        {q.type === 'text' && <TextQuestion />}

        {state.isCut && !state.showFrozen && (
          <View style={styles.cutBanner}>
            <Text style={styles.cutText}>✂️ تم قطعك - لا يمكنك الإجابة</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 50,
  },
  topBar: {
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
  stat: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  streakStat: {
    borderColor: COLORS.gold + '50',
  },
  tripleStat: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.gold + '20',
  },
  tripleText: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '900',
  },
  lastQStat: {
    borderColor: COLORS.red,
    backgroundColor: COLORS.red + '20',
  },
  lastQText: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentInner: {
    paddingBottom: 20,
  },
  question: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 16,
    lineHeight: 30,
    writingDirection: 'rtl',
  },
  hint: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.gold + '20',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.gold + '40',
  },
  hintIcon: {
    fontSize: 16,
  },
  hintText: {
    flex: 1,
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  options: {
    gap: 0,
  },
  lastSecondHint: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    writingDirection: 'rtl',
  },
  cutBanner: {
    backgroundColor: COLORS.red + '30',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.red + '50',
  },
  cutText: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
});
