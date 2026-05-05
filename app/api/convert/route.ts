import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const jobs = new Map<string, { status: string; result?: any; error?: string }>();

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const style = (formData.get('style') as string) || 'professional';

  if (!file) return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });

  const jobId = Math.random().toString(36).slice(2);
  jobs.set(jobId, { status: 'processing' });

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const isPdf = file.type === 'application/pdf';
  const mediaType = isPdf ? 'application/pdf' : file.type as any;

  const contentBlock: any = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

  const prompt = `この${isPdf ? 'PDF' : '画像'}を解析しスライド構成を作成してください。スタイル:${style}。JSON形式のみで返答:{"title":"タイトル","slides":[{"type":"title","title":"タイトル","subtitle":"サブ","body":"本文","bullets":["項目1"]}]}ルール:全テキスト抽出。3〜12枚。1枚目はtype:title。日本語で出力。`;

  client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }]
  }).then(message => {
    const text = message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    jobs.set(jobId, { status: 'done', result: parsed });
  }).catch(e => {
    jobs.set(jobId, { status: 'error', error: e.message });
  });

  return NextResponse.json({ jobId });
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  const job = jobs.get(jobId);
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 });
  return NextResponse.json(job);
}
