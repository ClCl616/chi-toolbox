export function DataNotice({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: string;
  empty?: string;
  onRetry?: () => void;
}) {
  if (loading)
    return <output className="data-notice">기록을 불러오는 중…</output>;
  if (error)
    return (
      <div className="data-notice error" role="alert">
        <span>{error}</span>
        {onRetry && (
          <button onClick={onRetry} type="button">
            다시 시도
          </button>
        )}
      </div>
    );
  if (empty)
    return (
      <div className="data-notice">
        <span>{empty}</span>
      </div>
    );
  return null;
}
