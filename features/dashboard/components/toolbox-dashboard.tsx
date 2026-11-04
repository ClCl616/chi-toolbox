'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ClipboardList, Megaphone, TriangleAlert } from 'lucide-react';
import { ToolboxPageHeader } from '@/shared/components/toolbox-ui';
import styles from './toolbox-dashboard.module.css';

const cards = [
  { id: 'news', title: '새 소식', href: '/toolbox/lms', icon: Megaphone },
  {
    id: 'assignments',
    title: '남은 과제',
    href: '/toolbox/lms',
    icon: ClipboardList,
  },
 ] as const;

export function ToolboxDashboard({
  assignmentHref = '/toolbox/lms',
  onOpenCard,
  newsCount,
  systemCount,
  assignmentCount,
  status,
}: {
  assignmentHref?: string;
  onOpenCard: (id: (typeof cards)[number]['id']) => void;
  newsCount: number | null;
  systemCount: number;
  assignmentCount: number | null;
  status: string | null;
}) {
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
            href={id === 'assignments' ? assignmentHref : href}
            onNavigate={() => onOpenCard(id)}
            className={styles.card}
            data-card={id}
            aria-label={`${title} · ${id === 'news' ? (newsCount ?? '미연결') : (assignmentCount ?? '미연결')}${id === 'news' && systemCount > 0 ? ` · 상태 알림 ${systemCount}` : ''}`}
          >
            <h2>{title}</h2>
            <Icon
              className={styles.illustration}
              strokeWidth={1.1}
              aria-hidden="true"
            />
            <div className={styles.metric}>
              <div className={styles.numbers}>
                <span className={styles.value}>
                  {(id === 'news' ? newsCount : assignmentCount) ?? '—'}
                </span>
                {id === 'news' && systemCount > 0 && (
                  <span className={styles.systemAlert} title="확인할 상태 알림이 있어요">
                    <TriangleAlert aria-hidden="true" />
                  </span>
                )}
              </div>
              {status && <span className={styles.status}>{status}</span>}
            </div>
          </Link>
        ))}
      </section>
    </section>
  );
}
