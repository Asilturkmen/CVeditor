import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Link2, List, Unlink } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { controlClass, Input } from '@/components/ui/Field'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { toHref } from '@/render/richtext'

/**
 * Açıklama düzenleyici: yalnız madde, kalın, italik, bağlantı. Renk ve
 * boyut şablondan gelir. Geri al/yinele editörün ortak geçmişindedir
 * (TipTap'in kendi geçmişi kapalı), böylece Ctrl+Z her alanda aynı çalışır.
 */
export function RichTextField({
  value,
  onChange,
  placeholder,
  id,
  label,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  id?: string
  label: string
}) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        orderedList: false,
        underline: false,
        undoRedo: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: null, target: null } },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    editorProps: {
      attributes: { 'aria-label': label, ...(id ? { id } : {}), role: 'textbox', 'aria-multiline': 'true' },
    },
    onUpdate({ editor }) {
      const html = editor.isEmpty ? '' : editor.getHTML()
      onChangeRef.current(html)
    },
  })

  // Dışarıdan gelen değişiklik (geri al, öneri kabulü) düzenleyiciye yansır.
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (current !== value) editor.commands.setContent(value || '', { emitUpdate: false })
  }, [editor, value])

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      list: e?.isActive('bulletList') ?? false,
      link: e?.isActive('link') ?? false,
      focused: e?.isFocused ?? false,
    }),
  })

  return (
    <div
      className={cn(
        controlClass,
        'rich-editor overflow-hidden p-0 text-sm',
        state?.focused && 'border-accent ring-3 ring-accent/15',
      )}
    >
      <div className="flex items-center gap-0.5 border-b border-line bg-surface-2/60 px-1.5 py-1">
        <ToolButton
          label={m.rich_bold()}
          shortcut="Ctrl+B"
          active={state?.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolButton>
        <ToolButton
          label={m.rich_italic()}
          shortcut="Ctrl+I"
          active={state?.italic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolButton>
        <ToolButton
          label={m.rich_bullets()}
          shortcut="Ctrl+Shift+8"
          active={state?.list}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolButton>
        <LinkButton editor={editor} active={state?.link ?? false} />
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolButton({
  label,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string
  shortcut?: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip content={shortcut ? `${label} · ${shortcut}` : label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md transition-colors [&_svg]:size-3.5',
          active ? 'bg-surface text-text shadow-sm ring-1 ring-line' : 'text-muted hover:bg-surface hover:text-text',
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function LinkButton({ editor, active }: { editor: ReturnType<typeof useEditor>; active: boolean }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')

  const apply = () => {
    if (!editor) return
    const href = toHref(url)
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else if (editor.state.selection.empty && !active) {
      editor.chain().focus().insertContent({ type: 'text', text: url.trim(), marks: [{ type: 'link', attrs: { href } }] }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    setOpen(false)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setUrl((editor?.getAttributes('link').href as string | undefined) ?? '')
      }}
    >
      <Tooltip content={m.rich_link()}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={m.rich_link()}
            aria-pressed={active}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-md transition-colors [&_svg]:size-3.5',
              active ? 'bg-surface text-text shadow-sm ring-1 ring-line' : 'text-muted hover:bg-surface hover:text-text',
            )}
          >
            <Link2 />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="pop z-50 w-72 rounded-xl border border-line bg-surface p-2.5 shadow-md"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              apply()
            }}
          >
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ornek.com"
              aria-label={m.rich_link_url()}
              className="h-8"
            />
            <Button type="submit" size="sm" variant="primary" className="h-8">
              {m.common_ok()}
            </Button>
            {active && (
              <Tooltip content={m.rich_unlink()}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-8"
                  aria-label={m.rich_unlink()}
                  onClick={() => {
                    editor?.chain().focus().extendMarkRange('link').unsetLink().run()
                    setOpen(false)
                  }}
                >
                  <Unlink />
                </Button>
              </Tooltip>
            )}
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
