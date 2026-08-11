import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function Toast() {
  const { state } = useGame();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;

  useEffect(() => {
    if (state.toast) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -30, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [state.toast]);

  if (!state.toast) return null;

  const colorMap = {
    green: '#22c55e',
    red: '#ef4444',
    gold: '#f59e0b',
  };
  const bg = colorMap[state.toast.color] || COLORS.border;

  return (
    <Animated.View style={[styles.container, { backgroundColor: bg, opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>{state.toast.msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 1000,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
