export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { analyzeFlow } from '@/lib/utils/analyzeFlow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smsText } = body;

    if (!smsText || typeof smsText !== 'string') {
      return NextResponse.json(
        { error: 'SMS metni gerekli' },
        { status: 400 }
      );
    }

    if (smsText.trim().length === 0) {
      return NextResponse.json(
        { error: 'SMS metni boş olamaz' },
        { status: 400 }
      );
    }

    const result = await analyzeFlow(smsText);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analiz hatası:', error);
    return NextResponse.json(
      { error: 'Analiz sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}

