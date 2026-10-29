'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, LayoutDashboard, Settings } from 'lucide-react';
import styles from './toolbox-shell.module.css';

const navigation = [
  { href: '/toolbox', label: '대시보드', icon: LayoutDashboard },
  { href: '/toolbox/lms', label: 'LMS', icon: BookOpen },
  { href: '/toolbox/settings', label: '설정', icon: Settings },
];

export function ToolboxShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#toolbox-content">
        본문으로 이동
      </a>
      <aside className={styles.sidebar}>
        <Link
          href="/toolbox"
          className={styles.brand}
          aria-label="Chi Toolbox 대시보드"
        >
          <span className={styles.mark} aria-hidden="true">
            C<span />
          </span>
          <span>Chi Toolbox</span>
        </Link>
        <nav className={styles.navigation} aria-label="주 메뉴">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              href === '/toolbox'
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={styles.navItem}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarNote}>나의 하루를 한곳에서.</div>
      </aside>
      <main id="toolbox-content" tabIndex={-1} className={styles.content}>
        {children}
      </main>
    </div>
  );
}
