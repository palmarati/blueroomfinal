import { NextResponse } from 'next/server';
import { Client } from 'square';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const env: 'production' | 'sandbox' =
      process.env.SQUARE_ENV === 'production' ? 'production' : 'sandbox';

    if (!process.env.SQUARE_ACCESS_TOKEN) {
      return NextResponse.json({ ok: false, error: 'SQUARE_ACCESS_TOKEN missing' }, { status: 500 });
    }

    const client = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN!,
      environment: env as any,
    });

    const { result } = await client.locationsApi.listLocations();
    const loc = result.locations?.find(
      l => l.status === 'ACTIVE' && (l.capabilities ?? []).includes('CREDIT_CARD_PROCESSING')
    );

    return NextResponse.json({
      ok: true,
      env,
      applicationIdPresent: Boolean(process.env.SQUARE_APPLICATION_ID),
      locationIdFound: Boolean(loc?.id),
      scriptUrl:
        env === 'production'
          ? 'https://web.squarecdn.com/v1/square.js'
          : 'https://sandbox.web.squarecdn.com/v1/square.js',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 });
  }
}


