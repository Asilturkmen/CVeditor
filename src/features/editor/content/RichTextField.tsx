import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Link2, List, Unlink } from 'lucide-react'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { controlClass, controlFocusedClass, controlOnContentClass } from '@/components/ui/controlClass'
import { Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { formatShortcut } from '@/lib/platform'
import { m } from '@/paraglide/messages'
import { toHref } from '@/render/richtext'

/** Düzenleyici eklentileri: yalnız madde, kalın, italik, bağlantı (TipTap'in kendi geçmişi kapalı). */
function richExtensions(placeholder: string) {
  return [
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
    Placeholder.configure({ placeholder }),
  ]
}

/**
 * Açıklama düzenleyici: yalnız madde, kalın, italik, bağlantı. Renk ve boyut şablondan gelir.
 * Geri al/yinele editörün ortak geçmişindedir (TipTap'in kendi geçmişi kapalı), böylece Ctrl+Z her
 * alanda aynı çalışır; dışarıdan gelen değişiklik (geri al, öneri kabulü) düzenleyiciye yansır.
 *
 * `variant`:
 * - `bare` (inspector grubu içinde): çerçevesiz. Üstte 36px satır (solda etiket, sağda biçim
 *   düğmeleri), altında metin; odakta metin bölgesine içe 2px vurgu halkası. Kutu içinde kutu yok.
 * - `framed` (grup dışı, ör. çeviri penceresi): tek başına alan görünümü.
 *
 * Eklenti listesi ve düzenleyici bir kez kurulur: her çizimde yeni `StarterKit.configure()` vermek
 * TipTap'e "seçenekler değişti" dedirtir ve her tuşta düzenleyiciyi yeniden yapılandırır.
 */
export const RichTextField = memo(function RichTextField({
  value,
  onChange,
  placeholder,
  id,
  label,
  variant = 'framed',
  showLabel = true,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  id?: string
  label: string
  variant?: 'framed' | 'bare'
  /** `bare`: etiketi biçim satırının solunda göster (özet gibi başlığı zaten görünen yerde kapat). */
  showLabel?: boolean
}) {
  // Düzenleyici bir kez kurulur; onUpdate her zaman en son onChange'i çağırsın.
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  })

  const extensions = useMemo(() => richExtensions(placeholder ?? ''), [placeholder])
  const editor = useEditor(
    {
      extensions,
      content: value,
      editorProps: {
        attributes: { 'aria-label': label, ...(id ? { id } : {}), role: 'textbox', 'aria-multiline': 'true' },
      },
      onUpdate({ editor }) {
        const html = editor.isEmpty ? '' : editor.getHTML()
        onChangeRef.current(html)
      },
    },
    [extensions, label, id],
  )

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

  const toolbar = (
    <div role="toolbar" aria-label={m.rich_toolbar({ name: label })} className="flex shrink-0 items-center gap-1">
      <ToolButton
        label={m.rich_bold()}
        shortcut={formatShortcut('Ctrl+B')}
        active={state?.bold}
        onClick={() => editor?.chain().focus().toggleBold().run()}
        icon={<Bold />}
      />
      <ToolButton
        label={m.rich_italic()}
        shortcut={formatShortcut('Ctrl+I')}
        active={state?.italic}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        icon={<Italic />}
      />
      <ToolButton
        label={m.rich_bullets()}
        shortcut={formatShortcut('Ctrl+Shift+8')}
        active={state?.list}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        icon={<List />}
      />
      <LinkButton editor={editor} active={state?.link ?? false} />
    </div>
  )

  if (variant === 'bare') {
    return (
      <div className="rich-editor min-w-0">
        <div className="flex min-h-9 items-center gap-2 pr-[calc(var(--row-px)-4px)] pl-[var(--row-px)]">
          <span className={cn('min-w-0 flex-1 text-body text-fg-2', !showLabel && 'sr-only')} aria-hidden>
            {label}
          </span>
          {toolbar}
        </div>
        <div
          className={cn(
            'mx-[calc(var(--row-px)-12px)] mb-1 cursor-text rounded-lg text-fg transition-shadow duration-150',
            state?.focused && 'shadow-[inset_0_0_0_2px_var(--accent)]',
          )}
          onMouseDown={(e) => {
            // Metnin altındaki boş yere tıklamak da düzenleyiciyi odaklar.
            if (e.target === e.currentTarget) {
              e.preventDefault()
              editor?.commands.focus('end')
            }
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn(controlClass, 'rich-editor overflow-hidden p-0', state?.focused && controlFocusedClass)}>
      <div className="flex items-center gap-1 border-b border-separator px-1.5 py-1">{toolbar}</div>
      <EditorContent editor={editor} />
    </div>
  )
})

function ToolButton({
  label,
  shortcut,
  active,
  onClick,
  icon,
}: {
  label: string
  shortcut?: string
  active?: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <IconButton
      label={label}
      shortcut={shortcut}
      icon={icon}
      active={active}
      aria-pressed={active}
      // Düğmeye basmak düzenleyicideki seçimi bozmasın.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    />
  )
}

function LinkButton({ editor, active }: { editor: Editor | null; active: boolean }) {
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
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setUrl((editor?.getAttributes('link').href as string | undefined) ?? '')
      }}
    >
      <PopoverTrigger asChild>
        <IconButton
          label={m.rich_link()}
          icon={<Link2 />}
          active={active}
          aria-pressed={active}
          onMouseDown={(e) => e.preventDefault()}
        />
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={m.rich_link()} className="w-80 p-3">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            apply()
          }}
        >
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              controlSize="sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={m.ph_website()}
              aria-label={m.rich_link_url()}
              className={controlOnContentClass}
            />
            {active && (
              <IconButton
                label={m.rich_unlink()}
                icon={<Unlink />}
                onClick={() => {
                  editor?.chain().focus().extendMarkRange('link').unsetLink().run()
                  setOpen(false)
                }}
              />
            )}
            <Button type="submit" variant="primary">
              {m.common_ok()}
            </Button>
          </div>
          <p className="text-callout text-fg-2">{m.rich_link_keys()}</p>
        </form>
      </PopoverContent>
    </Popover>
  )
}
