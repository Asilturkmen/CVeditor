import { cn } from '@/lib/cn'

/**
 * Grup DIŞINDAKİ metin alanı (dialog, arama, tek başına alan): 36px, yarıçap 10, yatay 12.
 * Varsayılan zemin gri pencere üstü içindir (beyaz + 1px kenar). Beyaz yüzey üstünde
 * `controlOnContentClass` ekle (gri dolgu, kenarsız). Yükseklik/iç boşluk `Input` ve `Textarea`'da.
 * Odak: zemin beyaz, 1px vurgu kenarı + 3px yumuşak vurgu halkası.
 */
export const controlClass = cn(
  'w-full rounded-lg bg-content text-body text-fg shadow-[inset_0_0_0_1px_var(--separator-strong)]',
  'transition-[box-shadow,background-color] duration-150',
  'focus:bg-content focus:shadow-[inset_0_0_0_1px_var(--accent),0_0_0_3px_color-mix(in_srgb,var(--accent)_25%,transparent)] focus:outline-none',
  'aria-invalid:shadow-[inset_0_0_0_1px_var(--danger)]',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

/** Odak görünümü, odağı kendisi almayan kap için (ör. zengin metin alanı; `state.focused` iken ver). */
export const controlFocusedClass =
  'bg-content shadow-[inset_0_0_0_1px_var(--accent),0_0_0_3px_color-mix(in_srgb,var(--accent)_25%,transparent)]'

/** Beyaz yüzey (grup, dialog) üstündeki tek başına alan: gri dolgu, kenarsız. */
export const controlOnContentClass = 'bg-fill-3 shadow-none'

/**
 * Grup İÇİNDEKİ çıplak alan: zemin, kenar, yarıçap yok; satırın kendisi alandır.
 * Odakta değer bölgesine içe dönük 2px vurgu halkası (yarıçap 6). Satır 40px, alan 32px (4px içeride).
 */
export const bareControlClass = cn(
  'w-full min-w-0 rounded-sm bg-transparent px-2 text-body text-fg outline-none',
  'focus:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none',
  'aria-invalid:shadow-[inset_0_0_0_2px_var(--danger)]',
  'disabled:cursor-not-allowed disabled:text-fg-3',
)
