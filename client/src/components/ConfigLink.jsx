import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ConfigLink — renders admin-configured content as:
 *  - a plain <div> when no link is configured
 *  - a clickable element when a link IS configured
 *
 * Redirect behavior (both work):
 *  - single click / tap
 *  - long press / hold (~500ms), e.g. on phones
 *
 * Link values:
 *  - starting with "/"  -> internal app navigation
 *  - anything else      -> external URL opened in a new tab
 */
const HOLD_MS = 500;

export default function ConfigLink({ href, className = '', children, ...rest }) {
  const navigate = useNavigate();
  const holdTimer = useRef(null);
  const holdFired = useRef(false);

  const hasLink = typeof href === 'string' && href.trim().length > 0;

  const open = () => {
    const url = href.trim();
    if (url.startsWith('/')) {
      navigate(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!hasLink) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  const startHold = (e) => {
    // Only primary pointer (left click / touch)
    if (e.button !== undefined && e.button !== 0) return;
    holdFired.current = false;
    holdTimer.current = setTimeout(() => {
      holdFired.current = true;
      open();
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  const handleClick = () => {
    if (holdFired.current) return; // already opened via hold
    open();
  };

  return (
    <div
      className={`${className} cursor-pointer select-none`}
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      title={href}
      {...rest}
    >
      {children}
    </div>
  );
}
