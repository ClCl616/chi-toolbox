'use client';
import { useEffect, useRef } from 'react';
import { ToolboxState } from '@/shared/components/toolbox-ui';
import { useLms } from '../use-lms';
import { displayTime } from '../model';
import styles from './lms-workspace.module.css';

export function LmsFeed() {
  const { snapshot, readIds, markRead } = useLms();
  const root = useRef<HTMLDivElement>(null);
  const positioned = useRef(false);
  useEffect(() => {
    const container = root.current;
    if (!container || !snapshot?.events.length) return;
    const read = new Set(readIds);
    const nodes = [
      ...container.querySelectorAll<HTMLElement>('[data-read-id]'),
    ];
    if (!positioned.current) {
      const firstUnread = nodes.find((node) => !read.has(node.dataset.readId!));
      (firstUnread ?? nodes.at(-1))?.scrollIntoView({
        block: firstUnread ? 'center' : 'end',
      });
      positioned.current = true;
    }
    const timers = new Map<Element, number>();
    const cancel = (node: Element) => {
      clearTimeout(timers.get(node));
      timers.delete(node);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.readId!;
          cancel(entry.target);
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.8 &&
            !read.has(id) &&
            document.visibilityState === 'visible'
          ) {
            timers.set(
              entry.target,
              window.setTimeout(() => {
                if (document.visibilityState === 'visible') markRead(id);
                timers.delete(entry.target);
              }, 800),
            );
          }
        }
      },
      { threshold: [0, 0.8, 1], rootMargin: '0px 0px -85px 0px' },
    );
    const frame = requestAnimationFrame(() =>
      nodes.forEach((node) => observer.observe(node)),
    );
    const visibility = () => {
      for (const node of timers.keys()) cancel(node);
      nodes.forEach((node) => {
        observer.unobserve(node);
        observer.observe(node);
      });
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const node of timers.keys()) cancel(node);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [snapshot, readIds, markRead]);
  if (!snapshot?.events.length)
    return (
      <ToolboxState kind="empty" title="아직 새 소식이 없어요">
        첫 수집 이후 등록되거나 변경된 소식부터 표시됩니다.
      </ToolboxState>
    );
  return (
    <div ref={root} className={styles.feed} aria-label="LMS 소식 피드">
      {snapshot.events.map((event) => (
        <article
          key={event.id}
          className={
            event.kind === 'system' ? styles.systemMessage : styles.message
          }
        >
          <header data-read-id={event.id}>
            <span className={styles.meta}>
              {[event.course, event.category].filter(Boolean).join(' · ')}
            </span>
            <h2>{event.title}</h2>
            <span className={styles.readState}>
              {readIds.includes(event.id) ? '읽음' : '읽지 않음'}
            </span>
          </header>
          {event.body && (
            <details>
              <summary>내용 보기</summary>
              <p className={styles.body}>{event.body}</p>
            </details>
          )}
          <time dateTime={event.detectedAt}>
            {displayTime(event.detectedAt)}
          </time>
        </article>
      ))}
    </div>
  );
}
