import type { SourceWinner } from '@/lib/types';

// Synthetic-but-realistic proven winners so the tool is clickable cold, with
// zero real client data. Each carries a different, liftable mechanism.
export const SAMPLE_WINNERS: SourceWinner[] = [
  {
    id: 'sample-blackout',
    label: 'Preparedness email — blackout angle',
    origin: 'sample',
    copy: `Subject: the sound your house makes right before the lights go out

You don't notice it until it's gone — the fridge hum, the AC, the little electrical hush a house always has.

Then it stops. And you're standing in the dark fumbling for a phone at 4% while the storm is just getting started.

Most people find out their "emergency kit" is a dead flashlight and a drawer of takeout matches at the exact moment they need it to work.

The folks who don't panic in a blackout aren't tougher. They just bought one thing ahead of time, while it was cheap and in stock.`,
    meta: { angle: 'loss aversion + cheap-now-vs-panic-later' },
  },
  {
    id: 'sample-wallet',
    label: 'DTC ad — slim wallet, anti-bulk hook',
    origin: 'sample',
    copy: `Pull your wallet out right now. Go ahead.

That fat leather brick bending your back pocket? You've been carrying 9 cards and a wad of receipts you'll never read again.

We built a wallet the size of two stacked credit cards that still holds everything you actually use. It clicks. It's aluminum. It will outlive the jeans you're wearing.

40,000 guys already made the switch. Most say the same thing: "I can't believe I carried that brick for years."`,
    meta: { angle: 'pattern-interrupt command + social proof + specificity' },
  },
  {
    id: 'sample-supplement',
    label: 'VSL opening — energy supplement',
    origin: 'sample',
    copy: `If you hit a wall at 2:30pm every single day — that heavy, foggy, "I need a nap or a third coffee" crash — it's almost never about sleep.

It's about what your body runs out of by mid-afternoon. And no, the answer isn't more caffeine. More caffeine is why you crash harder at 5.

I'm going to show you the 90-second morning fix a Stanford researcher stumbled into by accident — the one that killed my afternoon crash so completely I forgot it used to happen.`,
    meta: { angle: 'callout + mechanism reveal + curiosity gap' },
  },
];
