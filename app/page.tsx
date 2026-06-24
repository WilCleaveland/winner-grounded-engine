import Engine from './Engine';
import { SAMPLE_WINNERS } from '@/data/sampleWinners';

export default function Page() {
  return (
    <main className="wrap">
      <header className="masthead">
        <p className="kicker">Winner-Grounded Copy Engine</p>
        <h1 className="title">
          Hooks that learn from what already won.
        </h1>
        <p className="dek">
          Paste a proven winner. The engine finds the <em>mechanism</em> that
          made it convert, fires fresh hooks in your voice off that same
          mechanism, then stress-tests each one like a skeptical buyer before it
          survives. Not generic AI copy — direct response, grounded in what
          works.
        </p>
      </header>

      <Engine samples={SAMPLE_WINNERS} />

      <footer className="foot">
        Runs on Claude (claude-opus-4-8) with structured outputs. Ships with
        synthetic sample winners — no client data. Inputs: paste copy, or drop /
        paste a screenshot and vision reads the whole creative. Roadmap: URL /
        VSL transcript, Meta Ad Library by advertiser.
      </footer>
    </main>
  );
}
