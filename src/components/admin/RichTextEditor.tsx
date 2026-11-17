"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface RichTextEditorProps {
  /** Starting HTML. Later changes to this prop are ignored: the editor owns the text. */
  initialValue: string;
  onChange: (html: string) => void;
  /** Read out by screen readers in place of a visible <label>. */
  label: string;
  placeholder?: string;
}

/**
 * A small word-processor box: bold, italic, two heading sizes, lists, quotes
 * and links. It saves plain HTML limited to those tags (see lib/sanitize.ts
 * for the matching allow-list on the way out).
 */
export function RichTextEditor({ initialValue, onChange, label, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }, // h1 is the page title
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: initialValue,
    // Next.js renders this on the server first; the editor starts in the browser.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-journal max-w-none",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? "" : current.getHTML()),
  });

  return (
    <div className="field p-0">
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-rule" />}
      <EditorContent editor={editor} className="editor-content" />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkDraft, setLinkDraft] = useState<string | null>(null);

  // Which buttons are "on" for the current cursor position.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
    }),
  });

  function toggleLink() {
    if (active.link) editor.chain().focus().unsetLink().run();
    else setLinkDraft(editor.getAttributes("link").href ?? "");
  }

  function applyLink() {
    const href = linkDraft?.trim();
    if (href) {
      const url = /^(https?:\/\/|mailto:)/i.test(href) ? href : `https://${href}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkDraft(null);
  }

  return (
    <div className="border-b border-rule">
      <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap gap-0.5 p-1">
        <ToolButton
          label="Bold"
          pressed={active.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <span className="font-bold">B</span>
        </ToolButton>
        <ToolButton
          label="Italic"
          pressed={active.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="font-display italic">I</span>
        </ToolButton>
        <Divider />
        <ToolButton
          label="Heading"
          pressed={active.h2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolButton>
        <ToolButton
          label="Subheading"
          pressed={active.h3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolButton>
        <Divider />
        <ToolButton
          label="Bulleted list"
          pressed={active.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="currentColor">
            <circle cx="2" cy="4" r="1.3" />
            <circle cx="2" cy="8" r="1.3" />
            <circle cx="2" cy="12" r="1.3" />
            <path d="M5.5 3.3h9.5v1.4H5.5zM5.5 7.3h9.5v1.4H5.5zM5.5 11.3h9.5v1.4H5.5z" />
          </svg>
        </ToolButton>
        <ToolButton
          label="Numbered list"
          pressed={active.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolButton>
        <ToolButton
          label="Quote"
          pressed={active.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <span className="font-display text-lg leading-none">“</span>
        </ToolButton>
        <Divider />
        <ToolButton
          label={active.link ? "Remove link" : "Add link"}
          pressed={active.link}
          onClick={toggleLink}
        >
          Link
        </ToolButton>
      </div>

      {linkDraft !== null && (
        // Not a <form>: this sits inside the trip form, and forms cannot nest.
        <div className="flex gap-2 border-t border-rule p-2">
          <label htmlFor="editor-link" className="sr-only">
            Link address
          </label>
          <input
            id="editor-link"
            type="text"
            inputMode="url"
            autoFocus
            className="field min-h-9 flex-1 py-1 text-sm"
            placeholder="https://…"
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              } else if (event.key === "Escape") {
                setLinkDraft(null);
              }
            }}
          />
          <button type="button" className="btn btn-sm" onClick={applyLink}>
            Apply
          </button>
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => setLinkDraft(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

interface ToolButtonProps {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ToolButton({ label, pressed, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        "grid h-9 min-w-9 place-items-center rounded-sm px-2 font-mono text-xs transition-colors",
        pressed ? "bg-ink text-paper" : "text-soft hover:bg-sunk hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 my-1.5 w-px bg-rule" />;
