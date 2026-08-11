import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GameProvider, useGame } from './src/GameContext';
import { COLORS } from './src/constants/theme';

import JoinScreen from './src/screens/JoinScreen';
import AbilitiesScreen from './src/screens/AbilitiesScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ResultScreen from './src/screens/ResultScreen';
import FinalScreen from './src/screens/FinalScreen';
import Toast from './src/components/Toast';
import TargetModal from './src/components/TargetModal';
import StoreOverlay from './src/components/StoreOverlay';
import PreQuestionModal from './src/components/PreQuestionModal';

function AppContent() {
  const { state } = useGame();

  const screens = {
    join: JoinScreen,
    abilities: AbilitiesScreen,
    lobby: LobbyScreen,
    game: GameScreen,
    result: ResultScreen,
    final: FinalScreen,
  };

  const Screen = screens[state.screen] || JoinScreen;

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={COLORS.bg} />
      <Screen />
      <Toast />
      <TargetModal />
      <StoreOverlay />
      <PreQuestionModal />
    </View>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});
