import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function TextQuestion() {
  const { state, actions } = useGame();
  const [answer, setAnswer] = useState('');

  if (!state.currentQ || state.currentQ.type !== 'text') return null;

  const handleSubmit = () => {
    if (!answer.trim()) return;
    actions.submitTextAnswer(answer.trim());
  };

  return (
    <View style={styles.container}>
      {!state.hasAnswered ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="اكتب إجابتك هنا..."
            placeholderTextColor={COLORS.muted + '80'}
            value={answer}
            onChangeText={setAnswer}
            textAlign="right"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.submit, !answer.trim() && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!answer.trim()}
          >
            <Text style={styles.submitText}>إرسال</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.submitted}>
          <Text style={styles.submittedText}>تم إرسال إجابتك ✅</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  submit: {
    backgroundColor: COLORS.green,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  submitted: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  submittedText: {
    color: COLORS.green,
    fontSize: 16,
    fontWeight: '700',
  },
});
