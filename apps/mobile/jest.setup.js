import 'react-native-gesture-handler/jestSetup';

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock')
);

// Mock react-native-mmkv
const mockMmkvStorage = new Map();
jest.mock('react-native-mmkv', () => {
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn((key, value) => {
        if (value === undefined || value === null) {
          mockMmkvStorage.delete(key);
        } else {
          mockMmkvStorage.set(key, String(value));
        }
      }),
      getString: jest.fn((key) => {
        const val = mockMmkvStorage.get(key);
        return (val !== undefined && val !== 'undefined') ? val : undefined;
      }),
      getNumber: jest.fn((key) => Number(mockMmkvStorage.get(key)) || 0),
      getBoolean: jest.fn((key) => mockMmkvStorage.get(key) === 'true'),
      delete: jest.fn((key) => mockMmkvStorage.delete(key)),
      getAllKeys: jest.fn(() => Array.from(mockMmkvStorage.keys())),
      clearAll: jest.fn(() => mockMmkvStorage.clear()),
    })),
  };
});

// Mock react-native-encrypted-storage
const mockEncryptedStorage = new Map();
jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn(async (key, value) => {
    mockEncryptedStorage.set(key, value);
  }),
  getItem: jest.fn(async (key) => {
    return mockEncryptedStorage.get(key) || null;
  }),
  removeItem: jest.fn(async (key) => {
    mockEncryptedStorage.delete(key);
  }),
  clear: jest.fn(async () => {
    mockEncryptedStorage.clear();
  }),
}));

// Mock onnxruntime-react-native
jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: {
    create: jest.fn().mockResolvedValue({
      run: jest.fn().mockResolvedValue({}),
    }),
  },
  Tensor: jest.fn(),
}));

// Mock vision camera
jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: jest.fn(),
  useCameraPermission: jest.fn(() => ({ hasPermission: true, requestPermission: jest.fn() })),
  useFrameProcessor: jest.fn(),
}));

// Mock vision camera face detector
jest.mock('react-native-vision-camera-face-detector', () => ({
  useFaceDetector: jest.fn(() => ({ detectFaces: jest.fn() })),
}));

// Mock react-native-worklets-core
jest.mock('react-native-worklets-core', () => ({
  useRunOnJS: jest.fn((fn) => fn),
  createRunOnJS: jest.fn((fn) => fn),
  runOnJS: jest.fn((fn) => fn),
}));
