// expo-speech-recognition requires a native development build.
// In Expo Go, isSpeechRecognitionSupported = false and the Home screen
// falls back to a text input. When a dev build is created (Phase 7),
// this hook will be updated to use ExpoSpeechRecognitionModule.

export interface SpeechState {
  isListening: boolean;
  transcript: string;
  error: string | null;
  elapsedSeconds: number;
}

export const isSpeechRecognitionSupported = false;

export function useSpeechRecognition() {
  return {
    state: {
      isListening: false,
      transcript: '',
      error: null,
      elapsedSeconds: 0,
    } as SpeechState,
    startListening: async () => {},
    stopListening: () => {},
    resetTranscript: () => {},
  };
}
