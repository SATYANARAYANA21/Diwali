import { lazy, Suspense, useState } from "react";
import { DiwaliPaper } from "./components/DiwaliPaper";
import { BackgroundMusic } from "./components/BackgroundMusic";

const DiwaliEnvironment = lazy(() => import("./components/DiwaliEnvironment").then((module) => ({ default: module.DiwaliEnvironment })));

export default function App() {
  const [paperReady, setPaperReady] = useState(false);

  return (
    <main className="experience">
      <Suspense fallback={null}><DiwaliEnvironment /></Suspense>
      <BackgroundMusic />
      <header className="masthead" aria-label="Diwali greeting">
        <span className="masthead__ornament" aria-hidden="true">✦</span>
        <span>DIWALI</span>
        <span className="masthead__rule" aria-hidden="true" />
        <span className="masthead__subtitle">A letter in light</span>
      </header>
      <section className={`letter-stage${paperReady ? " is-ready" : ""}`} aria-label="Interactive Diwali letter">
        <div className="letter-aura" aria-hidden="true" />
        <div className="paper-shell">
          <DiwaliPaper onReady={() => setPaperReady(true)} />
        </div>
        {!paperReady && <div className="loading-note" role="status">Kindling the light</div>}
      </section>
      <footer className="colophon" aria-hidden="true">
        <span>ONE NIGHT · A THOUSAND LIGHTS</span>
        <span className="colophon__diamond">◇</span>
        <span>MADE WITH LOVE</span>
      </footer>
    </main>
  );
}
