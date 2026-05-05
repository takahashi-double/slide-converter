'use client';
import { Suspense } from 'react';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ResultContent() {
  const params = useSearchParams();
  const router = useRouter();
  const success = params.get('success');
  const canceled = params.get('canceled');

  useEffect(() => {
    if (success) localStorage.removeItem('slideai_usage');
    const t = setTimeout(() => router.replace('/'), 3000);
    return () => clearTimeout(t);
  }, [success, router]);

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'sans-serif' }}>
      <div style={{ textAlign:'center', padding:40 }}>
        {success ? (
          <>
            <div style={{ fontSize:52, marginBottom:20 }}>🎉</div>
            <h1 style={{ fontSize:24, fontWeight:600, color:'#f0f0f0', marginBottom:12 }}>登録完了！</h1>
            <p style={{ color:'#888', fontSize:15 }}>3秒後にアプリへ移動します。</p>
          </>
        ) : (
          <>
            <div style={{ fontSize:52, marginBottom:20 }}>↩</div>
            <h1 style={{ fontSize:24, fontWeight:600, color:'#f0f0f0', marginBottom:12 }}>キャンセルしました</h1>
            <p style={{ color:'#888', fontSize:15 }}>3秒後にアプリへ戻ります。</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultContent />
    </Suspense>
  );
}
