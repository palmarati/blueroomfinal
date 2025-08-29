import { NextResponse } from 'next/server';
import { Client } from 'square/legacy';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const env: 'sandbox' | 'production' =
      process.env.SQUARE_ENV === 'production' ? 'production' : 'sandbox';

    if (!process.env.SQUARE_ACCESS_TOKEN) {
      return NextResponse.json({ ok: false, error: 'SQUARE_ACCESS_TOKEN missing' }, { status: 500 });
    }

    const client = new Client({
      bearerAuthCredentials: { accessToken: process.env.SQUARE_ACCESS_TOKEN! },
      // Cast to any to avoid importing Environment enum; runtime uses string env
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      environment: env as any,
    });

    const { result } = await client.locationsApi.listLocations();
    const loc = result.locations?.find(
      (l) => l.status === 'ACTIVE' && (l.capabilities ?? []).includes('CREDIT_CARD_PROCESSING')
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
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}


