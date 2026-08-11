import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/theme';
import { useGame } from '../GameContext';

export default function JoinScreen() {
  const { state, actions } = useGame();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setAvatar(base64);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      actions.toast('يجب السماح بالوصول للكاميرا', 'red');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setAvatar(base64);
    }
  };

  const handleJoin = () => {
    if (!name.trim()) {
      actions.toast('أدخل اسمك أولاً', 'red');
      return;
    }
    if (name.trim().length > 20) {
      actions.toast('الاسم طويل جداً (أقصى 20 حرف)', 'red');
      return;
    }
    actions.set({ _joinName: name.trim(), _joinAvatar: avatar });
    actions.goToScreen('abilities');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>تحدي الاسئلة</Text>
          <Text style={styles.subtitle}>انضم للعبة وتنافس مع اللاعبين</Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarIcon}>📷</Text>
                <Text style={styles.avatarLabel}>صورة</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.avatarButtons}>
            <TouchableOpacity style={styles.avatarBtn} onPress={pickImage}>
              <Text style={styles.avatarBtnText}>المعرض</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarBtn} onPress={takePhoto}>
              <Text style={styles.avatarBtnText}>الكاميرا</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>اسم اللاعب</Text>
          <TextInput
            style={styles.input}
            placeholder="أدخل اسمك..."
            placeholderTextColor={COLORS.muted + '60'}
            value={name}
            onChangeText={setName}
            maxLength={20}
            textAlign="right"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.joinBtn, !name.trim() && styles.joinBtnDisabled]}
            onPress={handleJoin}
            disabled={!name.trim()}
          >
            <Text style={styles.joinText}>التالي - اختر خصائصك</Text>
          </TouchableOpacity>
        </View>

        {!state.connected && (
          <View style={styles.disconnected}>
            <Text style={styles.disconnectedText}>جاري الاتصال بالسيرفر...</Text>
          </View>
        )}

        <Text style={styles.version}>v1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.green,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    writingDirection: 'rtl',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: COLORS.green,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  avatarIcon: {
    fontSize: 24,
  },
  avatarLabel: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },
  avatarButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  avatarBtn: {
    backgroundColor: COLORS.surface,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarBtnText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    writingDirection: 'rtl',
  },
  joinBtn: {
    backgroundColor: COLORS.green,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinBtnDisabled: {
    opacity: 0.4,
  },
  joinText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  disconnected: {
    marginTop: 16,
    alignItems: 'center',
  },
  disconnectedText: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: '600',
  },
  version: {
    color: COLORS.border,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
  },
});
