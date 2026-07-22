"use client";

import * as React from "react";

// Dictado por voz para inputs de búsqueda (Web Speech API). Progresivo: si el navegador no lo soporta
// (Firefox), `soportado=false` y el botón de mic no se muestra. Una frase por toque (no continuo).
// El idioma sigue el locale de la app (es → es-PR del negocio, en → en-US).

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDictado(locale: string, onTexto: (texto: string) => void): {
  soportado: boolean;
  escuchando: boolean;
  toggle: () => void;
} {
  const [escuchando, setEscuchando] = React.useState(false);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);
  const onTextoRef = React.useRef(onTexto);
  React.useEffect(() => {
    onTextoRef.current = onTexto;
  });

  const soportado = !!getRecognitionCtor();

  const toggle = React.useCallback(() => {
    if (recRef.current) {
      recRef.current.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = locale === "en" ? "en-US" : "es-PR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      if (t) onTextoRef.current(t);
    };
    rec.onend = () => {
      recRef.current = null;
      setEscuchando(false);
    };
    rec.onerror = () => {
      recRef.current = null;
      setEscuchando(false);
    };
    recRef.current = rec;
    setEscuchando(true);
    rec.start();
  }, [locale]);

  React.useEffect(() => () => recRef.current?.stop(), []);

  return { soportado, escuchando, toggle };
}
