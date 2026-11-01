'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ClipboardList, Megaphone } from 'lucide-react';
import { ToolboxPageHeader } from '@/shared/components/toolbox-ui';
import styles from './toolbox-dashboard.module.css';

const cards = [
  { id: 'news', title: '새 소식', href: '/toolbox/lms', icon: Megaphone },
  {
    id: 'assignments',
    title: '남은 과제',
    href: '/toolbox/lms/assignments',
    icon: ClipboardList,
  },
];

export function ToolboxDashboard() {
  const canvas = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    function scrollHorizontally(event: WheelEvent) {
      if (
        !element ||
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      if (element.scrollWidth <= element.clientWidth + 1) return;
      // Preserve trackpad horizontal gestures and browser zoom; translate mouse wheels only.
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientWidth
            : 1;
      element.scrollLeft += event.deltaY * unit;
    }
    element.addEventListener('wheel', scrollHorizontally, { passive: false });
    return () => element.removeEventListener('wheel', scrollHorizontally);
  }, []);

  return (
    <section className={styles.dashboard} data-dashboard>
      <ToolboxPageHeader title="대시보드" />
      <section
        ref={canvas}
        className={styles.canvas}
        aria-label="대시보드 카드"
      >
        {cards.map(({ id, title, href, icon: Icon }) => (
          <Link
            key={id}
            href={href}
            className={styles.card}
            data-card={id}
            aria-label={`${title} · 미연결`}
          >
            <h2>{title}</h2>
            <Icon
              className={styles.illustration}
              strokeWidth={1.1}
              aria-hidden="true"
            />
            <div className={styles.metric}>
              <span className={styles.value} aria-label="집계되지 않음">
                —
              </span>
              <span className={styles.status}>미연결</span>
            </div>
          </Link>
        ))}
      </section>
    </section>
  );
}
