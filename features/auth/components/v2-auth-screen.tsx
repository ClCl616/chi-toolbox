import { Suspense } from 'react';
import { DevLoginForm } from '@/features/auth/components/dev-login-form';
import styles from '@/features/auth/components/login.module.css';

export function V2AuthScreen() {
  return (
    <main className={styles.page}>
      <div className={styles.window}>
        <a href="/v2/dashboard" className={styles.brand}>
          <span aria-hidden="true">C</span>Chi Toolbox
        </a>
        <Suspense fallback={<output>로그인 화면을 불러오는 중…</output>}>
          <DevLoginForm />
        </Suspense>
      </div>
    </main>
  );
}
