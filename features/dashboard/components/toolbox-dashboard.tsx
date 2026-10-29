'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ClipboardList,
  GripVertical,
  Megaphone,
  Pencil,
  Plus,
} from 'lucide-react';
import {
  ToolboxPageHeader,
  ToolboxState,
} from '@/shared/components/toolbox-ui';
import {
  dashboardStorageKey,
  defaultCardLayout,
  moveCard,
  parseCardLayout,
} from '../card-layout';
import type { DashboardCard, DashboardCardId } from '../card-layout';
import ui from '@/shared/components/toolbox-ui.module.css';
import styles from './toolbox-dashboard.module.css';

const cardDetails = {
  news: {
    label: '읽지 않은 LMS 소식',
    href: '/toolbox/lms',
    action: '소식 확인',
    icon: Megaphone,
  },
  assignments: {
    label: '남은 과제',
    href: '/toolbox/lms/assignments',
    action: '과제 확인',
    icon: ClipboardList,
  },
};

const layoutChanged = 'chi-toolbox-dashboard-layout-changed';
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(layoutChanged, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(layoutChanged, onChange);
  };
}
function getSnapshot() {
  try {
    return window.localStorage.getItem(dashboardStorageKey) ?? '';
  } catch {
    return 'unavailable';
  }
}
function getServerSnapshot() {
  return null;
}

export function ToolboxDashboard() {
  const stored = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const saved = useMemo(() => parseCardLayout(stored), [stored]);
  const [draft, setDraft] = useState<DashboardCard[]>(defaultCardLayout);
  const ready = stored !== null;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dragged = useRef<DashboardCardId | null>(null);

  function beginEdit() {
    setDraft(saved);
    setEditing(true);
    setNotice('');
  }
  function save() {
    try {
      window.localStorage.setItem(dashboardStorageKey, JSON.stringify(draft));
      window.dispatchEvent(new Event(layoutChanged));
      setEditing(false);
      setError('');
      setNotice('카드 설정을 이 브라우저에 저장했어요.');
    } catch {
      setError(
        '카드 설정을 저장하지 못했어요. 브라우저 저장소 설정을 확인하거나 취소해 주세요.',
      );
    }
  }
  function reorder(source: DashboardCardId, target: DashboardCardId) {
    setDraft((cards) => moveCard(cards, source, target));
    setNotice(`${cardDetails[source].label} 카드의 순서를 변경했어요.`);
  }
  const visibleCards = editing ? draft : saved.filter((card) => card.visible);

  return (
    <>
      <ToolboxPageHeader
        title="대시보드"
        description={editing ? '필요한 카드만, 원하는 순서로.' : undefined}
        action={
          editing ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={ui.button}
                onClick={() => {
                  setEditing(false);
                  setError('');
                  setNotice('변경을 취소했어요.');
                }}
              >
                취소
              </button>
              <button
                type="button"
                className={`${ui.button} ${ui.primary}`}
                onClick={save}
              >
                저장
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={ui.button}
              onClick={beginEdit}
              disabled={!ready}
            >
              <Pencil size={15} aria-hidden="true" />
              카드 편집
            </button>
          )
        }
      />
      {(error || stored === 'unavailable') && (
        <div className={styles.error} role="alert">
          {error || '브라우저 저장소를 사용할 수 없어 기본 구성을 표시합니다.'}
        </div>
      )}
      {editing && (
        <p className={styles.editHint}>
          카드를 끌거나 순서 버튼으로 이동하세요. 설정은 이 브라우저에만
          저장됩니다.
        </p>
      )}
      {!ready ? (
        <ToolboxState kind="loading" title="화면을 준비하고 있어요">
          카드 설정을 불러오는 중입니다.
        </ToolboxState>
      ) : visibleCards.length === 0 ? (
        <ToolboxState
          kind="empty"
          title="표시할 카드를 선택해 주세요"
          action={
            <button type="button" className={ui.button} onClick={beginEdit}>
              <Plus size={16} aria-hidden="true" />
              카드 선택
            </button>
          }
        >
          카드를 숨겨도 왼쪽 또는 하단 메뉴에서 LMS를 열 수 있어요.
        </ToolboxState>
      ) : (
        <div className={styles.grid} aria-label="대시보드 카드">
          {visibleCards.map((card, index) => {
            const detail = cardDetails[card.id];
            const Icon = detail.icon;
            const content = (
              <>
                <div className={styles.label}>
                  <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
                  <h2>{detail.label}</h2>
                </div>
                <div
                  className={styles.value}
                  aria-label="연결 전, 집계되지 않음"
                >
                  —
                </div>
                <span className={styles.disconnected}>LMS 연결 필요</span>
              </>
            );
            return editing ? (
              <div
                key={card.id}
                className={styles.card}
                data-card={card.id}
                data-hidden={!card.visible}
              >
                <div className={styles.controls}>
                  <span
                    className={styles.dragHandle}
                    draggable
                    onDragStart={(event) => {
                      dragged.current = card.id;
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', card.id);
                    }}
                    onDragEnd={() => {
                      dragged.current = null;
                    }}
                    title="끌어서 순서 변경"
                    aria-hidden="true"
                  >
                    <GripVertical size={22} />
                  </span>
                  <label className={styles.visibility}>
                    <span>표시</span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-checked={card.visible}
                      checked={card.visible}
                      aria-label={`${detail.label} 표시`}
                      onChange={() =>
                        setDraft((cards) =>
                          cards.map((item) =>
                            item.id === card.id
                              ? { ...item, visible: !item.visible }
                              : item,
                          ),
                        )
                      }
                    />
                    <span className={styles.switchTrack} aria-hidden="true" />
                  </label>
                </div>
                <div
                  className={styles.dropArea}
                  onDragOver={(event) => {
                    if (dragged.current) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged.current) reorder(dragged.current, card.id);
                    dragged.current = null;
                  }}
                >
                  {content}
                </div>
                <div className={styles.orderControls}>
                  <button
                    type="button"
                    className={styles.orderButton}
                    aria-label={`${detail.label} 앞으로 이동`}
                    disabled={index === 0}
                    onClick={() => reorder(card.id, draft[index - 1].id)}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                    앞으로
                  </button>
                  <button
                    type="button"
                    className={styles.orderButton}
                    aria-label={`${detail.label} 뒤로 이동`}
                    disabled={index === draft.length - 1}
                    onClick={() => reorder(card.id, draft[index + 1].id)}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                    뒤로
                  </button>
                </div>
              </div>
            ) : (
              <Link
                key={card.id}
                href={detail.href}
                className={styles.card}
                data-card={card.id}
                aria-label={`${detail.label} · LMS 연결 필요 · ${detail.action}`}
              >
                {content}
                <span className={styles.cardAction}>
                  {detail.action}
                  <ArrowRight size={18} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <output className={styles.notice}>{notice}</output>
    </>
  );
}
