import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { getToken } from "@/lib/api";

const ABOUT_IMAGE_PREFIX = "/api/settings/about-images/";

function isAboutImageUrl(src: string | undefined): boolean {
  return Boolean(src?.startsWith(ABOUT_IMAGE_PREFIX));
}

function AuthImage({ src, alt }: { src?: string; alt?: string }) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      return;
    }

    if (!isAboutImageUrl(src)) {
      setResolvedSrc(src);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadImage() {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await fetch(src!, { headers });
      if (!response.ok) {
        if (!cancelled) setResolvedSrc(null);
        return;
      }
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setResolvedSrc(objectUrl);
    }

    void loadImage();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!resolvedSrc) return null;

  return (
    <img
      src={resolvedSrc}
      alt={alt ?? ""}
      className="my-4 max-w-full rounded-lg border border-border"
      loading="lazy"
    />
  );
}

interface MarkdownContentProps {
  markdown: string;
  className?: string;
}

export default function MarkdownContent({ markdown, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-10 text-lg font-semibold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="mt-6 text-sm font-medium">{children}</h3>,
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-foreground underline-offset-4 hover:underline"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noreferrer" : undefined}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-border pl-4 text-sm text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-border" />,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted/40 px-3 py-2 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2 text-muted-foreground">{children}</td>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>
          ),
          img: ({ src, alt }) => <AuthImage src={src} alt={alt} />,
          strong: ({ children }) => (
            <strong className="font-medium text-foreground">{children}</strong>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
