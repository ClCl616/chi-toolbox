import { Suspense } from 'react';
import { DevLoginForm } from '@/features/auth/components/dev-login-form';
import styles from '@/features/auth/components/login.module.css';

export const metadata = { title: '로그인' };

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.window}>
        <a href="/dev/dashboard" className={styles.brand}>
          <span aria-hidden="true">C</span>Chi Toolbox
        </a>
        <Suspense fallback={<output>로그인 화면을 불러오는 중…</output>}>
          <DevLoginForm />
        </Suspense>
      </div>
    </main>
  );
}
