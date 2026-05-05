import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const style = (formData.get('style') as string) || 'professional';
    if (!file) return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: '4MB以下にしてください' }, { status: 400 });
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const isPdf = file.type === 'application/pdf';
    const contentBlock: any = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } };
    const prompt = `この${isPdf ? 'PDF' : '画像'}を解析しスライド構成を作成してください。スタイル:${style}。JSON形式のみで返答:{"title":"タイトル","slides":[{"type":"title","title":"タイトル","subtitle":"サブ","body":"本文","bullets":["項目1"]}]}ルール:全テキスト抽出。3〜12枚。1枚目はtype:title。日本語で出力。`;
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }]
    });
    const text = message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'エラーが発生しました' }, { status: 500 });
  }
}
