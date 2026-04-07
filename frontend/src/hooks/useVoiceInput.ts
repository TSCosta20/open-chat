"use client";

import { useCallback, useRef, useState } from "react";

type OnResult = (text: string) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

export function useVoiceInput(onResult: OnResult) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<AnySpeechRecognition>(null);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    recognitionRef.current?.stop();

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: AnySpeechRecognition) => {
      const transcript = event.results[0][0].transcript as string;
      if (transcript.trim()) onResult(transcript.trim());
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const supported =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ("SpeechRecognition" in (window as any) || "webkitSpeechRecognition" in (window as any));

  return { isListening, startListening, stopListening, supported };
}

/** Speak text aloud using the browser's TTS engine. */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
