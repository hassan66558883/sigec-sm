type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function AttachmentList({ attachments, downloadBaseUrl }: { attachments: Attachment[]; downloadBaseUrl: string }) {
  if (attachments.length === 0) return null;
  return (
    <ul className="space-y-1">
      {attachments.map((a) => (
        <li key={a.id} className="text-sm">
          <a href={`${downloadBaseUrl}/${a.id}`} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
            {a.fileName}
          </a>
          <span className="ml-2 text-xs text-[var(--color-text-muted)]">({formatSize(a.sizeBytes)})</span>
        </li>
      ))}
    </ul>
  );
}
