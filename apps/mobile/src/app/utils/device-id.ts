import { Platform } from 'react-native';
import { storage } from './mmkv-storage';

const DEVICE_ID_KEY = 'app_device_id';

export function getDeviceId(): string {
  let deviceId = storage.getString(DEVICE_ID_KEY);
  if (!deviceId) {
    const randomPart =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const timestampPart = Date.now().toString(36);
    deviceId = `dev_${Platform.OS}_${randomPart}_${timestampPart}`;
    storage.set(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function getDeviceInfo(): string {
  return `${Platform.OS.toUpperCase()} App Installation`;
}
