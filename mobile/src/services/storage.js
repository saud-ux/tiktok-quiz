import AsyncStorage from '@react-native-async-storage/async-storage';

const PID_KEY = 'quiz_pid';
const PLAYER_KEY = 'quiz_player';

export async function getOrCreatePid() {
  let pid = await AsyncStorage.getItem(PID_KEY);
  if (!pid) {
    pid = 'p' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    await AsyncStorage.setItem(PID_KEY, pid);
  }
  return pid;
}

export async function savePlayer(data) {
  await AsyncStorage.setItem(PLAYER_KEY, JSON.stringify(data));
}

export async function getSavedPlayer() {
  const raw = await AsyncStorage.getItem(PLAYER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function clearPlayer() {
  await AsyncStorage.multiRemove([PID_KEY, PLAYER_KEY]);
}
