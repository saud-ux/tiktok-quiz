import { Audio } from 'expo-av';

let soundObjects = {};

const SOUND_FILES = {
  tick: require('../assets/sounds/tick.wav'),
  correct: require('../assets/sounds/correct.wav'),
  wrong: require('../assets/sounds/wrong.wav'),
  buzzer: require('../assets/sounds/buzzer.wav'),
  reveal: require('../assets/sounds/reveal.wav'),
  attackHit: require('../assets/sounds/attack_hit.wav'),
  lastQuestion: require('../assets/sounds/last_question.wav'),
  bonusChime: require('../assets/sounds/bonus_chime.wav'),
};

export async function initAudio() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch (e) {
    // Audio init failed, sounds will be unavailable
  }
}

export async function playSound(name) {
  try {
    const file = SOUND_FILES[name];
    if (!file) return;

    if (soundObjects[name]) {
      try {
        await soundObjects[name].replayAsync();
        return;
      } catch {
        // If replay fails, create a new sound object
      }
    }

    const { sound } = await Audio.Sound.createAsync(file, {
      shouldPlay: true,
      volume: 0.5,
    });
    soundObjects[name] = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        // Keep the sound loaded for reuse
      }
    });
  } catch (e) {
    // Sound playback failed silently
  }
}

export async function cleanupSounds() {
  for (const key of Object.keys(soundObjects)) {
    try {
      await soundObjects[key].unloadAsync();
    } catch {}
  }
  soundObjects = {};
}
