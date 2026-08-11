import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function StoreVoteOverlay() {
  const { state, actions } = useGame();
  if (!state.showStoreVote) return null;

  const { yes, no, voted, total, secsLeft } = state.storeVoteData;
  const pctYes = total > 0 ? Math.round((yes / total) * 100) : 0;
  const pctNo = total > 0 ? Math.round((no / total) * 100) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>هل يفتح المتجر؟</Text>
      <Text style={styles.timer}>{secsLeft}s</Text>
      {!state.storeVoted ? (
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, styles.yesBtn]}
            onPress={() => actions.castStoreVote('yes')}
          >
            <Text style={styles.btnText}>نعم</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.noBtn]}
            onPress={() => actions.castStoreVote('no')}
          >
            <Text style={styles.btnText}>لا</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.results}>
          <Text style={styles.resultText}>نعم {pctYes}% — لا {pctNo}%</Text>
          <Text style={styles.resultSub}>{voted}/{total} صوّتوا</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.gold,
    zIndex: 80,
  },
  title: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  timer: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  yesBtn: {
    backgroundColor: COLORS.green,
  },
  noBtn: {
    backgroundColor: COLORS.red,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  results: {
    alignItems: 'center',
  },
  resultText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  resultSub: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
});
