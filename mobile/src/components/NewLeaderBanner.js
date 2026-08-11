import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function NewLeaderBanner() {
  const { state } = useGame();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state.newLeaderName) {
      translateY.setValue(-80);
      opacity.setValue(1);
      Animated.sequence([
        Animated.spring(translateY, { toValue: 0, friction: 6, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [state.newLeaderName]);

  if (!state.newLeaderName) return null;

  return (
    <Animated.View style={[styles.banner, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>👑 {state.newLeaderName} أصبح المتصدر!</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    zIndex: 105,
  },
  text: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    writingDirection: 'rtl',
  },
});
