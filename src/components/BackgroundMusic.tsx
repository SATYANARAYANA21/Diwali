import { useEffect, useRef, useState } from "react";
import diwaliMusic from "../../music/BRAHMĀSTRA (Telugu) Kumkumala Video Ranbir Alia Pritam Sid Sriram Chandrabose.mp3";

type MusicState = "starting" | "playing" | "paused" | "blocked" | "error";

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<MusicState>("starting");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    let mounted = true;
    audio.volume = 0.3;
    audio.loop = true;

    const syncPlayback = () => {
      if (mounted) setState(audio.paused ? "paused" : "playing");
    };
    const markError = () => {
      if (mounted) setState("error");
    };

    audio.addEventListener("play", syncPlayback);
    audio.addEventListener("pause", syncPlayback);
    audio.addEventListener("error", markError);

    if (audio.paused) {
      audio.play().then(() => {
        if (mounted) setState("playing");
      }).catch((error: unknown) => {
        if (!mounted) return;
        const name = error instanceof DOMException ? error.name : "";
        setState(audio.error ? "error" : name === "NotAllowedError" ? "blocked" : "error");
      });
    } else {
      setState("playing");
    }

    return () => {
      mounted = false;
      audio.removeEventListener("play", syncPlayback);
      audio.removeEventListener("pause", syncPlayback);
      audio.removeEventListener("error", markError);
      audio.pause();
    };
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    setState("starting");
    try {
      await audio.play();
      setState("playing");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setState(audio.error ? "error" : name === "NotAllowedError" ? "blocked" : "error");
    }
  };

  const accessibleLabel = state === "playing"
    ? "Pause background music"
    : state === "error"
      ? "Retry background music"
      : state === "starting"
        ? "Starting background music"
        : "Play background music";

  return (
    <>
      <audio ref={audioRef} src={diwaliMusic} preload="auto" loop aria-hidden="true" />
      <button
        className={`music-control music-control--${state}`}
        type="button"
        onClick={togglePlayback}
        aria-label={accessibleLabel}
        aria-pressed={state === "playing"}
        title={accessibleLabel}
      >
        <svg className="music-control__icon" viewBox="0 0 24 24" aria-hidden="true">
          {state === "playing" ? (
            <>
              <rect className="music-control__bar music-control__bar--one" x="5" y="9" width="3" height="8" rx="1.5" />
              <rect className="music-control__bar music-control__bar--two" x="10.5" y="5" width="3" height="14" rx="1.5" />
              <rect className="music-control__bar music-control__bar--three" x="16" y="8" width="3" height="9" rx="1.5" />
            </>
          ) : (
            <path d="M9 5.7v12.6a1 1 0 0 1-1.5.86L5.7 18.1a2.3 2.3 0 1 1 2.3-4V7.2l10-2.1v9.7a1 1 0 0 1-1.5.86l-1.8-1.04a2.3 2.3 0 1 1 2.3-4V7.3L9 9z" />
          )}
        </svg>
        {state === "blocked" && <span className="music-control__label" aria-hidden="true">Play music</span>}
      </button>
      <span className="music-control__status" aria-live="polite">
        {state === "playing" ? "Background music playing" : state === "paused" ? "Background music paused" : state === "error" ? "Background music is unavailable" : state === "blocked" ? "Tap to start background music" : "Starting background music"}
      </span>
    </>
  );
}
