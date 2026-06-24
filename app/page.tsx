import Engine from './Engine';

export default function Page() {
  return (
    <main className="wrap">
      <header className="masthead">
        <p className="kicker">Winner-Grounded Copy Engine</p>
        <h1 className="title">
          Hooks that learn from what already won.
        </h1>
        <p className="dek">
          This isn&rsquo;t a prompt wrapper on a cold Claude session: every hook
          is built on my own direct-response playbook, distilled from a deep
          library of winning swipes and proven ideation frameworks. Then a
          tell-scanner built from an analysis of 89,239 Reddit posts quietly
          strips the giveaways of machine copy (the reflex em dash, the
          &ldquo;not X, but Y&rdquo; beat, the worn diction) so what survives
          reads like a person wrote it.
        </p>
      </header>

      <Engine />

      <footer className="foot">
        Runs on Claude (claude-opus-4-8) with structured outputs. No client data
        ships in this build. Inputs: a sales page URL, pasted copy, or a dropped
        screenshot the vision model reads as a whole creative. Roadmap: VSL
        transcript, Meta Ad Library by advertiser.
      </footer>
    </main>
  );
}
