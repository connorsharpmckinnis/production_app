import { useRef, useState } from "react";
import { ImagePlus, Pencil, X } from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";

interface AboutPageEditorProps {
  initialMarkdown: string;
  onSaved: (markdown: string) => void;
  onCancel: () => void;
}

export default function AboutPageEditor({
  initialMarkdown,
  onSaved,
  onCancel,
}: AboutPageEditorProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  async function handleSave() {
    const trimmed = markdown.trim();
    if (!trimmed) {
      toast.error("Add some content before saving.");
      return;
    }

    setSaving(true);
    try {
      const saved = await api.updateAboutPage(trimmed);
      onSaved(saved.markdown ?? trimmed);
      toast.success("About page saved");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to save About page"));
    } finally {
      setSaving(false);
    }
  }

  async function handleImageSelected(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await api.uploadAboutImage(file);
      setMarkdown((current) => {
        const separator = current.endsWith("\n") || current.length === 0 ? "" : "\n\n";
        return `${current}${separator}${uploaded.markdown}\n`;
      });
      toast.success("Image inserted");
    } catch (err) {
      toast.error(formatApiError(err, "Failed to upload image"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function insertMarkdown(before: string, after = "") {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdown.slice(start, end);
    const next = `${markdown.slice(0, start)}${before}${selected}${after}${markdown.slice(end)}`;
    setMarkdown(next);

    requestAnimationFrame(() => {
      const cursor = start + before.length + selected.length + after.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={showPreview ? "outline" : "default"}
          onClick={() => setShowPreview(false)}
        >
          <Pencil />
          Edit
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showPreview ? "default" : "outline"}
          onClick={() => setShowPreview(true)}
        >
          Preview
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus />
          {uploading ? "Uploading…" : "Insert image"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(event) => void handleImageSelected(event.target.files?.[0])}
        />
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>
            <X />
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => insertMarkdown("**", "**")}
        >
          Bold
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => insertMarkdown("*", "*")}
        >
          Italic
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => insertMarkdown("## ", "")}
        >
          Heading
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => insertMarkdown("- ", "")}
        >
          List
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => insertMarkdown("[", "](url)")}
        >
          Link
        </Button>
      </div>

      {showPreview ? (
        <div className="min-h-[24rem] rounded-lg border border-border bg-card p-6">
          <MarkdownContent markdown={markdown} className="space-y-4" />
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          className="min-h-[24rem] font-mono text-sm"
          placeholder="Write About page content in Markdown…"
        />
      )}

      <p className="text-xs text-muted-foreground">
        Supports Markdown headings, lists, links, tables, and embedded images. Images are stored
        in the app database and only visible to signed-in users.
      </p>
    </div>
  );
}
