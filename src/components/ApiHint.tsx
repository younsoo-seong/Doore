import { type CSSProperties, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ApiHintContent } from '../utils/apiHints';

interface ApiHintProps {
  hint: ApiHintContent;
  children: ReactNode;
  align?: 'left' | 'right';
  fullWidth?: boolean;
}

const CARD_WIDTH = 320;
const VIEWPORT_GAP = 12;
const TRIGGER_GAP = 8;

export default function ApiHint({ hint, children, align = 'right', fullWidth = false }: ApiHintProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({
    left: VIEWPORT_GAP,
    top: VIEWPORT_GAP,
    width: CARD_WIDTH,
  });

  const updatePosition = useCallback(() => {
    const trigger = wrapRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(CARD_WIDTH, viewportWidth - VIEWPORT_GAP * 2);
    const measuredHeight = cardRef.current?.scrollHeight || 190;
    const maxUsableHeight = viewportHeight - VIEWPORT_GAP * 2;
    const desiredHeight = Math.min(measuredHeight, maxUsableHeight);

    const preferredLeft = align === 'left' ? rect.left : rect.right - width;
    const left = Math.min(
      Math.max(preferredLeft, VIEWPORT_GAP),
      viewportWidth - width - VIEWPORT_GAP,
    );

    const belowSpace = viewportHeight - rect.bottom - TRIGGER_GAP - VIEWPORT_GAP;
    const aboveSpace = rect.top - TRIGGER_GAP - VIEWPORT_GAP;
    const showAbove = belowSpace < desiredHeight && aboveSpace > belowSpace;

    const top = showAbove
      ? Math.max(VIEWPORT_GAP, rect.top - TRIGGER_GAP - desiredHeight)
      : Math.min(rect.bottom + TRIGGER_GAP, viewportHeight - VIEWPORT_GAP - desiredHeight);

    const maxHeight = showAbove
      ? Math.max(120, rect.top - TRIGGER_GAP - VIEWPORT_GAP)
      : Math.max(120, viewportHeight - top - VIEWPORT_GAP);

    setCardStyle({
      left,
      top,
      width,
      maxHeight: Math.min(maxHeight, maxUsableHeight),
    });
  }, [align]);

  const openHint = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeHint = useCallback(() => {
    setIsOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => updatePosition();
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isOpen, updatePosition]);

  return (
    <span
      ref={wrapRef}
      className={`api-hint-wrap ${fullWidth ? 'full-width' : ''}`}
      onMouseEnter={openHint}
      onMouseLeave={closeHint}
      onFocus={openHint}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          closeHint();
        }
      }}
    >
      {children}
      {isOpen && (
        <span ref={cardRef} className="api-hint-card" style={cardStyle}>
          <span className="api-hint-title">{hint.title}</span>
          <span className="api-hint-row">
            <strong>API</strong>
            <code>{hint.api}</code>
          </span>
          <span className="api-hint-row">
            <strong>ERD</strong>
            <span>{hint.erd.join(' -> ')}</span>
          </span>
          {hint.event && (
            <span className="api-hint-row">
              <strong>Event</strong>
              <span>{hint.event}</span>
            </span>
          )}
          <span className="api-hint-result">{hint.result}</span>
        </span>
      )}
    </span>
  );
}
