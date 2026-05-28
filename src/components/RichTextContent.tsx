import type { CSSProperties } from 'react';

const allowedTags = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'div', 'p', 'span']);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const formatRichTextHtml = (content: string) => {
  if (!content) return '';

  const hasRichTags = /<\/?(b|strong|i|em|u|br|div|p|span)\b/i.test(content);
  if (!hasRichTags) return escapeHtml(content).replace(/\n/g, '<br>');

  return content
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, tagName: string) => {
      const normalized = tagName.toLowerCase();
      if (!allowedTags.has(normalized)) return '';
      if (tag.startsWith('</')) return normalized === 'br' ? '' : `</${normalized}>`;
      return normalized === 'br' ? '<br>' : `<${normalized}>`;
    });
};

type RichTextContentProps = {
  content?: string | null;
  emptyText?: string;
  className?: string;
  style?: CSSProperties;
  emptyStyle?: CSSProperties;
};

export default function RichTextContent({
  content,
  emptyText = '작성된 내용이 없습니다.',
  className,
  style,
  emptyStyle,
}: RichTextContentProps) {
  if (!content?.trim()) {
    return <span style={emptyStyle}>{emptyText}</span>;
  }

  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: formatRichTextHtml(content) }}
    />
  );
}
