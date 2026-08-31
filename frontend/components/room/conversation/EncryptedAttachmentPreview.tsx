"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AttachmentRef } from "@/types/deal-room";

interface EncryptedAttachmentPreviewProps {
  attachment: AttachmentRef;
  onLoad: (
    attachment: AttachmentRef,
  ) => Promise<Blob>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EncryptedAttachmentPreview({
  attachment,
  onLoad,
}: EncryptedAttachmentPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lowerName = attachment.fileName.toLowerCase();
  const isImage = attachment.mimeType.startsWith("image/");
  const isVideo = attachment.mimeType.startsWith("video/");
  const isPdf = attachment.mimeType === "application/pdf" || lowerName.endsWith(".pdf");
  const isDoc = /\.(doc|docx|xls|xlsx|ppt|pptx|txt|rtf)$/i.test(lowerName);

  const label = useMemo(() => {
    if (isImage) return "Photo";
    if (isVideo) return "Video";
    if (isPdf) return "PDF";
    if (isDoc) return "Document";
    return "File";
  }, [isImage, isVideo, isPdf, isDoc]);

  async function load(): Promise<string | null> {
    if (url) return url;
    if (loading) return null;

    setLoading(true);
    setError(null);

    try {
      const blob = await onLoad(attachment);
      const nextUrl = URL.createObjectURL(blob);
      setUrl(nextUrl);
      return nextUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decrypt this file.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isImage || isVideo) void load();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
    // The attachment id is immutable for one message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id]);

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-wire/55 bg-black/15">
      {isImage && url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex max-h-[420px] min-h-48 w-full items-center justify-center bg-black/30"
          aria-label={`Open ${attachment.fileName}`}
        >
          <img
            src={url}
            alt={attachment.fileName}
            className="h-auto max-h-[420px] w-full object-contain"
          />
        </a>
      )}

      {isVideo && url && (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className="max-h-80 w-full bg-black object-contain"
        />
      )}

      {isPdf && url && (
        <iframe
          src={url}
          title={attachment.fileName}
          className="h-72 w-full bg-white"
        />
      )}

      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-paper/72">
            {attachment.fileName}
          </p>
          <p className="mt-0.5 text-[8px] text-paper/28">
            {label} · {formatSize(attachment.size)} · encrypted
          </p>
        </div>

        {!url && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="shrink-0 rounded-lg border border-signal/25 px-2.5 py-1.5 text-[9px] text-signal/70 disabled:opacity-40"
          >
            {loading ? "Decrypting…" : isPdf ? "View" : "Open"}
          </button>
        )}

        {url && (
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-wire/70 px-2.5 py-1.5 text-[9px] text-paper/55 transition hover:border-signal/30 hover:text-signal"
            >
              Open
            </a>

            <a
              href={url}
              download={attachment.fileName}
              className="rounded-lg border border-signal/25 bg-signal/[0.05] px-2.5 py-1.5 text-[9px] text-signal/75 transition hover:bg-signal/10"
            >
              Download
            </a>
          </div>
        )}
      </div>

      {error && (
        <p className="border-t border-wire/40 px-3 py-2 text-[9px] text-danger/80">
          {error}
        </p>
      )}
    </div>
  );
}
