import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useGame } from '../GameContext';

export default function AttackOverlay() {
  const { state } = useGame();
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state.attackHit) {
      scale.setValue(0.3);
      opacity.setValue(1);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [state.attackHit]);

  if (!state.attackHit) return null;

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ scale }] }]}>
      <Text style={styles.icon}>{state.attackHit.icon}</Text>
      <Text style={styles.text}>{state.attackHit.msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '35%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    zIndex: 90,
  },
  icon: {
    fontSize: 50,
    marginBottom: 8,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
