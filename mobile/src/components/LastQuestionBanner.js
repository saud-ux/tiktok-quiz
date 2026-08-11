import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function LastQuestionBanner() {
  const { state } = useGame();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state.showLastQAnnouncement) {
      scale.setValue(0.5);
      opacity.setValue(1);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.1, friction: 4, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [state.showLastQAnnouncement]);

  if (!state.showLastQAnnouncement) return null;

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ scale }] }]}>
      <Text style={styles.icon}>🔥</Text>
      <Text style={styles.title}>السؤال الأخير!</Text>
      <Text style={styles.sub}>المركز الأخير يحصل على ×3 نقاط</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 14, 5, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 110,
  },
  icon: {
    fontSize: 60,
    marginBottom: 12,
  },
  title: {
    color: COLORS.gold,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
  },
  sub: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
});
