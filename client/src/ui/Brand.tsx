/** The wordmark used on the signed-out pages. The dashboard header has its own inline copy sized for the bar. */
export function AuthBrand() {
  return (
    <div className="auth-brand">
      <span className="auth-brand-mark" aria-hidden>
        <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6.2" height="9" rx="1.4" />
          <rect x="8.8" y="1" width="6.2" height="5" rx="1.4" />
          <rect x="8.8" y="7.8" width="6.2" height="7.2" rx="1.4" />
          <rect x="1" y="11.8" width="6.2" height="3.2" rx="1.4" />
        </svg>
      </span>
      <span className="auth-brand-name">Boards</span>
    </div>
  );
}
