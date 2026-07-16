import { useState } from 'react';

interface CopyButtonProps {
  /** Text to copy to the clipboard */
  text: string;
  /** Optional class name for styling */
  className?: string;
  /** Children to render inside the button */
  children?: React.ReactNode;
}

/**
 * A simple copy‑to‑clipboard button with feedback.
 * It uses the modern Clipboard API (`navigator.clipboard.writeText`).
 * When the copy succeeds the button shows a temporary "Copied!" label
 * (or you can customise via children). After a short timeout the label
 * reverts to the original content.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  className = '',
  children,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Copy failed', err);
    }
  };

  return (
    <button type="button" className={className} onClick={handleCopy}>
      {copied ? 'Copied!' : children ?? 'Copy'}
    </button>
  );
};
