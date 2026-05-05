import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const config = { api: { bodyParser: false } };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const style = (formData.get('style') as string) || 'professional';

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズは20MB以下にしてください' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const isPdf = file.type === 'application/pdf';
    const mediaType = file.type as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

    const contentBlock: any = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

    const prompt = `あなたはプレゼンテーションデザイナーです。この${isPdf ? 'PDFドキュメント' : '画像'}を解析し、全ての内容を抽出してスライド構成を作成してください。

スタイル: ${style}

以下のJSON形式のみで返答してください（マークダウン・バッククォート不要）:
{
  "title": "プレゼンタイトル",
  "slides": [
    {
      "type": "title",
      "title": "スライドタイトル",
      "subtitle": "サブタイトル（任意）",
      "body": "本文",
      "bullets": ["箇条書き1", "箇条書き2"]
    }
  ]
}

ルール:
- 全テキスト・構造を漏れなく抽出
- 最低3枚・最大15枚
- 1枚目は必ず type: "title"
- type は title / bullets / content のいずれか
- bullets は箇条書きスライドのみ使用（最大8項目）
- タイトル最大20文字、箇条書き1項目最大40文字
- 日本語で出力
- 判読困難な部分は "[判読困難]" と記載`;

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: prompt }]
        }
      ]
    });

    const text = message.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error('Convert error:', e);
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI応答の解析に失敗しました。再度お試しください。' }, { status: 500 });
    }
    return NextResponse.json({ error: e.message || '変換中にエラーが発生しました' }, { status: 500 });
  }
}
