'use client';
import { useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { returnPath } from '../return-path';
import styles from './login.module.css';

type Field = 'email' | 'password';
type Errors = Partial<Record<Field, string>>;

function fieldError(field: Field, input: HTMLInputElement, signup: boolean) {
  if (field === 'email') {
    if (!input.value.trim()) return '이메일을 입력해 주세요.';
    if (input.validity.typeMismatch) return '이메일 주소 형식을 확인해 주세요.';
  } else {
    if (!input.value) return '비밀번호를 입력해 주세요.';
    if (signup && input.value.length < 8)
      return '비밀번호를 8자 이상 입력해 주세요.';
  }
  return undefined;
}

export function DevLoginForm() {
  const params = useSearchParams();
  const next = returnPath(params.get('returnTo'), '/dev/dashboard');
  const [signup, setSignup] = useState(false);
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [googleError, setGoogleError] = useState(
    ['callback', 'google-config'].includes(params.get('error') ?? ''),
  );
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  function change(field: Field, input: HTMLInputElement) {
    if (errors[field])
      setErrors({ ...errors, [field]: fieldError(field, input, signup) });
    setMessage('');
  }
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !email.current || !password.current) return;
    const issues = {
      email: fieldError('email', email.current, signup),
      password: fieldError('password', password.current, signup),
    };
    setErrors(issues);
    setMessage('');
    setSuccess(false);
    if (issues.email || issues.password) {
      (issues.email ? email.current : password.current).focus();
      return;
    }
    busy.current = true;
    setPending('email');
    try {
      const response = await fetch(
        signup ? '/api/auth/signup' : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: email.current.value.trim(),
            password: password.current.value,
          }),
        },
      );
      if (!response.ok) {
        if (response.status >= 500)
          setMessage(
            '인증 서비스를 이용할 수 없어요. 잠시 후 다시 시도해 주세요.',
          );
        else if (signup)
          setMessage('가입하지 못했어요. 입력 내용을 확인해 주세요.');
        else setMessage('이메일 또는 비밀번호를 확인해 주세요.');
      } else if (signup) {
        setSuccess(true);
        setMessage('가입 확인 메일을 보냈습니다. 이메일을 확인해 주세요.');
      } else {
        window.location.assign(next);
        return;
      }
    } catch {
      setMessage(
        '연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
      );
    }
    busy.current = false;
    setPending(null);
  }
  function google() {
    if (busy.current) return;
    busy.current = true;
    setPending('google');
    setGoogleError(false);
    window.location.assign(
      '/api/auth/google?screen=dev&next=' + encodeURIComponent(next),
    );
  }
  const googleControl = (
    <>
      <button
        type="button"
        className={styles.google}
        disabled={!!pending}
        onClick={google}
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.5 9.5 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z"
          />
          <path
            fill="#34A853"
            d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3C9.1 39.5 16 44 24 44z"
          />
          <path
            fill="#FBBC05"
            d="M12.6 27.5a12 12 0 0 1 0-7v-5.3H5.8a20 20 0 0 0 0 17.6z"
          />
          <path
            fill="#EA4335"
            d="M24 12.1c3 0 5.6 1 7.7 3l5.8-5.8C33.9 6 29.5 4 24 4 16 4 9.1 8.5 5.8 15.2l6.8 5.3C14.2 15.7 18.7 12.1 24 12.1z"
          />
        </svg>
        {pending === 'google' ? 'Google로 이동 중…' : 'Google로 계속하기'}
      </button>
      {googleError && (
        <p role="alert" className={styles.error}>
          Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
    </>
  );
  return (
    <section
      className={styles.panel}
      aria-label={signup ? '회원가입' : '로그인'}
    >
      <div className={styles.desktopGoogle}>
        <h2>간편 로그인</h2>
        {googleControl}
      </div>
      <div className={styles.emailArea}>
        <h2 className={signup ? undefined : styles.emailTitle}>
          {signup ? '회원가입' : '이메일 로그인'}
        </h2>
        <form
          onSubmit={submit}
          noValidate
          aria-label={signup ? '회원가입' : '이메일 로그인'}
        >
          {(['email', 'password'] as const).map((field) => {
            const label = field === 'email' ? '이메일' : '비밀번호';
            return (
              <div className={styles.field} key={field}>
                <label htmlFor={field}>{label}</label>
                <input
                  id={field}
                  name={field}
                  type={field}
                  placeholder={label}
                  required
                  readOnly={!!pending}
                  ref={field === 'email' ? email : password}
                  autoComplete={
                    field === 'email'
                      ? 'email'
                      : signup
                        ? 'new-password'
                        : 'current-password'
                  }
                  aria-invalid={!!errors[field]}
                  aria-describedby={
                    errors[field] ? field + '-error' : undefined
                  }
                  onChange={(e) => change(field, e.currentTarget)}
                />
                {errors[field] && (
                  <p className={styles.error} id={field + '-error'}>
                    {errors[field]}
                  </p>
                )}
              </div>
            );
          })}
          {message && (
            <p
              role={success ? 'status' : 'alert'}
              className={success ? styles.success : styles.error}
            >
              {message}
            </p>
          )}
          <button type="submit" className={styles.primary} disabled={!!pending}>
            {pending === 'email'
              ? signup
                ? '가입 중…'
                : '로그인 중…'
              : signup
                ? '계정 만들기'
                : '로그인'}
          </button>
        </form>
        <div className={styles.mobileGoogle}>
          <div className={styles.divider}>또는</div>
          {googleControl}
        </div>
        <button
          type="button"
          className={styles.switchMode}
          disabled={!!pending}
          onClick={() => {
            setSignup(!signup);
            setErrors({});
            setMessage('');
            setGoogleError(false);
            if (password.current) password.current.value = '';
          }}
        >
          {signup ? '로그인으로 돌아가기' : '회원가입'}
        </button>
      </div>
    </section>
  );
}
