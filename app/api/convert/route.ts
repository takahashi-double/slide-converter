import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';


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
