import React from 'react';
import { View, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { isPresetAvatarUri, presetIdFromUri, findPreset } from './AvatarPresets';

interface AvatarProps {
  uri?: string | null;
  size?: number;
}

// Circular avatar per Design §4.6 (radius-full is the only fully-round
// token per §6.2). Three states: a real hosted photo, a bundled icon preset
// (uri starting with "preset:" — see AvatarPresets.ts), or the fallback
// plain person icon when nothing is set yet.
export function Avatar({ uri, size = 88 }: AvatarProps) {
  if (uri && isPresetAvatarUri(uri)) {
    const preset = findPreset(presetIdFromUri(uri));
    if (preset) {
      return (
        <View
          className="items-center justify-center"
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: preset.bg }}
        >
          <Feather name={preset.icon} size={size * 0.45} color="#FFFFFF" />
        </View>
      );
    }
  }

  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      className="items-center justify-center bg-surface-alt"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Feather name="user" size={size * 0.45} color="#767676" />
    </View>
  );
}
