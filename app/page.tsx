'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

const FREE_LIMIT = 3;
const MONTHLY_LIMIT = 50;
const STORAGE_KEY = 'slideai_usage';

function getUsage(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
}
function incrementUsage() {
  const n = getUsage() + 1;
  localStorage.setItem(STORAGE_KEY, String(n));
  return n;
}

type Step = 'idle' | 'analyzing' | 'building' | 'done' | 'error';

interface SlideData {
  title: string;
  slides: Array<{
    type: string;
    title: string;
    subtitle?: string;
    body?: string;
    bullets?: string[];
  }>;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [style, setStyle] = useState('professional');
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [slides, setSlides] = useState<SlideData | null>(null);
  const [usage, setUsage] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setUsage(getUsage()); }, []);

  const handleFile = useCallback((f: File) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(f.type)) { setError('PDF・PNG・JPG・WEBPのみ対応しています'); return; }
    if (f.size > 20 * 1024 * 1024) { setError('ファイルサイズは20MB以下にしてください'); return; }
    setFile(f); setError(''); setSlides(null); setStep('idle');
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const convert = async () => {
    if (!file) return;
    if (usage >= FREE_LIMIT) { setShowPaywall(true); return; }

    setStep('analyzing'); setError(''); setSlides(null);

    try {
      const formData = new FormData();
      const compressed = await compressImage(file);
      formData.append('file', compressed);
      formData.append('style', style);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);
      const res = await fetch('/api/convert', { method: 'POST', body: formData, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'サーバーエラーが発生しました');
      }
      const data = await res.json();
      setSlides(data);
      setStep('building');

      // Build PPTX in browser
      await buildAndDownload(data, file.name, style);

      const newUsage = incrementUsage();
      setUsage(newUsage);
      setStep('done');
    } catch (e: any) {
      setError(e.message || '変換に失敗しました');
      setStep('error');
    }
  };

  const startCheckout = async () => {
    setLoadingCheckout(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError('決済ページの読み込みに失敗しました');
      setLoadingCheckout(false);
    }
  };

  const remaining = Math.max(0, FREE_LIMIT - usage);
  const isPdf = file?.type === 'application/pdf';

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
            <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em' }}>SlideAI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {remaining > 0 ? `無料残り ${remaining}回` : '無料枠終了'}
            </span>
            <button onClick={() => setShowPaywall(true)} style={{
              padding: '8px 18px', borderRadius: 8, background: 'var(--accent)',
              color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500
            }}>
              980円/月 →
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 80px' }}>
        {/* Hero */}
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: 20,
            background: 'var(--accent-dim)', color: 'var(--accent)',
            fontSize: 12, fontWeight: 500, marginBottom: 20, border: '1px solid rgba(124,111,247,0.3)'
          }}>AI搭載 · 即時変換</div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: 16 }}>
            写真・PDFを<br />
            <span style={{ color: 'var(--accent)' }}>スライドに変換</span>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
            AIが内容を自動解析。PowerPoint形式でダウンロード、そのまま編集できます。
          </p>
        </div>

        {/* Drop Zone */}
        <div className="fade-up-1"
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !file && fileRef.current?.click()}
          style={{
            border: `1.5px dashed ${dragging ? 'var(--accent)' : file ? 'var(--border-hover)' : 'var(--border)'}`,
            borderRadius: 16, padding: file ? '20px 24px' : '52px 24px',
            textAlign: 'center', cursor: file ? 'default' : 'pointer',
            background: dragging ? 'var(--accent-dim)' : 'var(--surface)',
            transition: 'all 0.2s', position: 'relative'
          }}>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

          {!file ? (
            <>
              <div style={{ fontSize: 36, marginBottom: 14 }}>⬆</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>ファイルをドロップ または クリックして選択</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>PDF・PNG・JPG・WEBP · 最大20MB</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {['PDF（テキスト）', 'PDF（スキャン）', 'JPG / PNG', 'WEBP'].map(t => (
                  <span key={t} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{t}</span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {isPdf ? '📋' : '🖼'}
              </div>
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{(file.size / 1024 / 1024).toFixed(1)} MB · {isPdf ? 'PDF' : '画像'}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); setFile(null); setStep('idle'); setSlides(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1 }}>✕</button>
            </div>
          )}
        </div>

        {/* Style Selector */}
        {file && (
          <div className="fade-up" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { id: 'professional', label: 'プロフェッショナル', desc: 'ビジネス・報告書向け' },
              { id: 'creative', label: 'クリエイティブ', desc: '提案書・企画書向け' },
              { id: 'minimal', label: 'シンプル', desc: '余白を活かしたデザイン' },
              { id: 'bold', label: 'インパクト重視', desc: '発表・プレゼン向け' },
            ].map(s => (
              <div key={s.id} onClick={() => setStyle(s.id)} style={{
                padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${style === s.id ? 'var(--accent)' : 'var(--border)'}`,
                background: style === s.id ? 'var(--accent-dim)' : 'var(--surface)',
                transition: 'all 0.15s'
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, color: style === s.id ? 'var(--accent)' : 'var(--text)' }}>{s.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Convert Button */}
        <button onClick={convert} disabled={!file || step === 'analyzing' || step === 'building'}
          style={{
            marginTop: 20, width: '100%', padding: '16px', borderRadius: 12,
            background: (!file || step === 'analyzing' || step === 'building') ? 'var(--surface2)' : 'var(--accent)',
            color: (!file || step === 'analyzing' || step === 'building') ? 'var(--text-dim)' : 'white',
            border: 'none', cursor: (!file || step === 'analyzing' || step === 'building') ? 'not-allowed' : 'pointer',
            fontSize: 15, fontWeight: 600, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            animation: (file && step === 'idle') ? 'pulse-glow 2s ease-in-out infinite' : 'none'
          }}>
          {step === 'analyzing' && <><span className="spinner" /> AIが解析中...</>}
          {step === 'building' && <><span className="spinner" /> スライドを生成中...</>}
          {(step === 'idle' || step === 'error') && 'スライドを生成する →'}
          {step === 'done' && '✓ 完了 — 再生成する'}
        </button>

        {/* Progress Steps */}
        {(step === 'analyzing' || step === 'building') && (
          <div style={{ marginTop: 20, padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {[
              { label: 'ファイルをアップロード', done: true },
              { label: 'AIがコンテンツを解析', done: step === 'building', active: step === 'analyzing' },
              { label: 'PPTXスライドを生成', done: false, active: step === 'building' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13,
                color: s.done ? 'var(--success)' : s.active ? 'var(--text)' : 'var(--text-dim)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: s.done ? 'var(--success)' : s.active ? 'var(--accent)' : 'var(--border)' }} />
                {s.done ? '✓ ' : s.active ? '' : ''}{s.label}
              </div>
            ))}
          </div>
        )}

        {/* Result */}
        {step === 'done' && slides && (
          <div className="fade-up" style={{ marginTop: 20, padding: '20px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>変換完了 — {slides.slides.length}枚のスライドを生成</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>ダウンロードが自動で開始されました。</p>

            {/* Google Slides instruction */}
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 16 }}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 6 }}>📌 Google スライドで使う場合</strong>
              1. Google ドライブを開く<br />
              2. 「新規」→「ファイルのアップロード」で .pptx を選択<br />
              3. ファイルを右クリック →「Google スライドで開く」
            </div>

            {/* Slide preview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              {slides.slides.map((s, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', minHeight: 80 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>スライド {i + 1}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {s.bullets ? s.bullets.slice(0, 2).join(' / ') : (s.body || s.subtitle || '')}
                  </div>
                </div>
              ))}
            </div>

            {/* Usage indicator */}
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: remaining > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${remaining > 0 ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`, fontSize: 12, color: remaining > 0 ? 'var(--success)' : 'var(--warning)' }}>
              {remaining > 0 ? `✓ 無料枠 残り ${remaining} 回` : '⚠ 無料枠終了 — 続けるには980円/月プランへ'}
            </div>
          </div>
        )}

        {/* Features */}
        <div style={{ marginTop: 60, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { icon: '🧠', title: 'AI自動解析', desc: 'Claude AIが画像・PDFの内容を読み取り構造化' },
            { icon: '✏️', title: '編集可能', desc: 'PowerPoint形式でダウンロード。そのまま修正可能' },
            { icon: '📊', title: '全形式対応', desc: 'スキャンPDF・写真・テキストPDFに対応' },
          ].map(f => (
            <div key={f.title} style={{ padding: '20px 16px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Paywall Modal */}
      {showPaywall && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 36, maxWidth: 400, width: '100%', position: 'relative' }}>
            <button onClick={() => setShowPaywall(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.02em' }}>無料枠を使い切りました</h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                引き続き利用するには<br />スタンダードプランをご利用ください
              </p>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: '20px 24px', marginBottom: 24, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>スタンダードプラン</span>
                <span style={{ fontSize: 24, fontWeight: 700 }}>¥980<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>/月</span></span>
              </div>
              {['変換回数 無制限', 'PDF・画像 全形式対応', 'PowerPoint形式でダウンロード', 'Google スライド連携ガイド付き', 'いつでもキャンセル可能'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '5px 0', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓</span> {f}
                </div>
              ))}
            </div>
            <button onClick={startCheckout} disabled={loadingCheckout}
              style={{ width: '100%', padding: '15px', borderRadius: 12, background: 'var(--accent)', color: 'white', border: 'none', cursor: loadingCheckout ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: loadingCheckout ? 0.7 : 1 }}>
              {loadingCheckout ? <><span className="spinner" /> 処理中...</> : '今すぐ始める — ¥980/月'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>Stripeの安全な決済を使用 · SSL暗号化</p>
          </div>
        </div>
      )}
    </main>
  );
}

// Browser-side PPTX builder

async function compressImage(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const MAX = 1200;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(new File([blob!], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.7);
    };
    img.src = url;
  });
}

async function buildAndDownload(data: SlideData, fileName: string, style: string) {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js';
  document.head.appendChild(script);
  await new Promise(r => script.onload = r);

  const PptxGenJS = (window as any).PptxGenJS;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const themes: Record<string, any> = {
    professional: { bgTitle: '1E2761', textTitle: 'FFFFFF', bg: 'FFFFFF', titleColor: '1E2761', bodyColor: '36454F', accent: '065A82' },
    creative:     { bgTitle: '990011', textTitle: 'FFFFFF', bg: 'FFFFFF', titleColor: '990011', bodyColor: '993C1D', accent: 'F96167' },
    minimal:      { bgTitle: 'F1EFE8', textTitle: '2C2C2A', bg: 'FFFFFF', titleColor: '2C2C2A', bodyColor: '5F5E5A', accent: '888780' },
    bold:         { bgTitle: '028090', textTitle: 'FFFFFF', bg: 'FFFFFF', titleColor: '028090', bodyColor: '0F6E56', accent: '02C39A' },
  };
  const t = themes[style] || themes.professional;

  data.slides.forEach((slide, i) => {
    const s = pptx.addSlide();
    s.background = { color: i === 0 ? t.bgTitle : t.bg };

    if (i === 0) {
      s.addText(slide.title || data.title, {
        x: 0.7, y: 2.0, w: 11.6, h: 1.6,
        fontSize: 40, bold: true, color: t.textTitle,
        fontFace: 'Calibri', align: 'left', wrap: true
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.7, y: 3.8, w: 11.6, h: 0.9,
          fontSize: 20, color: t.textTitle, fontFace: 'Calibri Light', align: 'left'
        });
      }
    } else if (slide.type === 'bullets' && slide.bullets?.length) {
      s.addText(slide.title, {
        x: 0.6, y: 0.4, w: 11.8, h: 0.9,
        fontSize: 28, bold: true, color: t.titleColor, fontFace: 'Calibri'
      });
      s.addText(slide.bullets.map(b => ({ text: b, options: { bullet: true, fontSize: 16, color: t.bodyColor, fontFace: 'Calibri', paraSpaceAfter: 8 } })), {
        x: 0.7, y: 1.5, w: 11.3, h: 4.8, valign: 'top', wrap: true
      });
    } else {
      s.addText(slide.title, {
        x: 0.6, y: 0.4, w: 11.8, h: 0.9,
        fontSize: 28, bold: true, color: t.titleColor, fontFace: 'Calibri'
      });
      if (slide.body) {
        s.addText(slide.body, {
          x: 0.7, y: 1.5, w: 11.3, h: 4.8,
          fontSize: 16, color: t.bodyColor, fontFace: 'Calibri', wrap: true, valign: 'top'
        });
      }
    }
    s.addText(`${i + 1}`, { x: 12.1, y: 6.9, w: 0.5, h: 0.3, fontSize: 10, color: 'AAAAAA', align: 'right' });
  });

  const baseName = fileName.replace(/\.[^/.]+$/, '');
  await pptx.writeFile({ fileName: `${baseName}_slides.pptx` });
}
