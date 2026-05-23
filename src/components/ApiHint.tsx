import type { ReactNode } from 'react';
import type { ApiHintContent } from '../utils/apiHints';

interface ApiHintProps {
  hint: ApiHintContent;
  children: ReactNode;
  align?: 'left' | 'right';
  fullWidth?: boolean;
}

export default function ApiHint({ hint, children, align = 'right', fullWidth = false }: ApiHintProps) {
  return (
    <span className={`api-hint-wrap ${fullWidth ? 'full-width' : ''}`}>
      {children}
      <span className={`api-hint-card ${align === 'left' ? 'left' : ''}`}>
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
    </span>
  );
}
