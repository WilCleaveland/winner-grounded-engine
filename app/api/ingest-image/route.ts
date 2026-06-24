import { NextResponse } from 'next/server';
import { extractCreativeFromImage, type ImageMediaType } from '@/lib/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 60;

const OK: ImageMediaType[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export async function POST(req: Request) {
  try {
    const { image, mediaType } = (await req.json()) as {
      image?: string;
      mediaType?: string;
    };
    if (!image) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }
    let mt = (mediaType || '').toLowerCase();
    if (mt === 'image/jpg') mt = 'image/jpeg';
    if (!OK.includes(mt as ImageMediaType)) {
      return NextResponse.json(
        { error: `Unsupported image type "${mediaType}". Use PNG, JPEG, WebP, or GIF.` },
        { status: 400 },
      );
    }

    const out = await extractCreativeFromImage(image, mt as ImageMediaType);
    return NextResponse.json(out);
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Could not read the image.';
    const overloaded = /overloaded|\b429\b|\b529\b|rate.?limit/i.test(raw);
    return NextResponse.json(
      {
        error: overloaded
          ? 'Claude is briefly overloaded — try the image again in a moment.'
          : raw,
      },
      { status: overloaded ? 503 : 500 },
    );
  }
}
