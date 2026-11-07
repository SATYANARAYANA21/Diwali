import { useEffect, useRef, useState, type CSSProperties } from "react";
import diwaliDocumentUrl from "../shaders/3d-paper/sources/diwali-letter.html?url";

type DiwaliPaperProps = {
  className?: string;
  style?: CSSProperties;
  onReady?: () => void;
};

/** Keeps the authored sandbox and visibility lifecycle, with the Diwali artwork source. */
export function DiwaliPaper({ className = "", style, onReady }: DiwaliPaperProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [hostVisible, setHostVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [documentSource, setDocumentSource] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setHostVisible(entry?.isIntersecting ?? true), { rootMargin: "80px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const mounted = hostVisible && documentVisible;

  useEffect(() => {
    setReady(false);
    setDocumentSource(null);
    setLoadFailed(false);
    if (!mounted) return undefined;
    let active = true;
    fetch(diwaliDocumentUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load the Diwali paper (${response.status})`);
        return response.text();
      })
      .then((source) => { if (active) setDocumentSource(source); })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [mounted]);

  return (
    <div
      ref={hostRef}
      className={`threeui-background three-d-paper${className ? ` ${className}` : ""}`}
      role="group"
      aria-label="Interactive Diwali letter"
      data-state={!mounted ? "paused" : loadFailed ? "error" : ready ? "ready" : "loading"}
      style={{ position: "relative", overflow: "hidden", background: "transparent", pointerEvents: "auto", ...style }}
    >
      {mounted && documentSource && (
        <iframe
          title="An interactive Diwali letter"
          srcDoc={documentSource}
          sandbox="allow-scripts"
          loading="eager"
          onLoad={() => { setReady(true); onReady?.(); }}
          style={{
            position: "absolute", inset: 0, display: "block", width: "100%", height: "100%",
            border: 0, background: "transparent", opacity: ready ? 1 : 0,
            pointerEvents: ready ? "auto" : "none", transition: "opacity 240ms ease-out",
          }}
        />
      )}
    </div>
  );
}
