import type { ReactNode } from 'react';
import { CircleAlert, Inbox, LoaderCircle, PlugZap } from 'lucide-react';
import styles from './toolbox-ui.module.css';

export function ToolboxPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  );
}

export function ToolboxState({
  kind,
  title,
  children,
  action,
}: {
  kind: 'empty' | 'unconnected' | 'loading' | 'error';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = {
    empty: Inbox,
    unconnected: PlugZap,
    loading: LoaderCircle,
    error: CircleAlert,
  }[kind];
  return (
    <div
      className={styles.state}
      data-kind={kind}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading'}
    >
      <span className={styles.stateIcon}>
        <Icon size={26} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
