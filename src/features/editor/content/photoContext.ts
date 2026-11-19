import { createContext, useContext } from 'react'
import { isSafePhoto } from '@/cv/photo'

/** Paneldeki tek fotoğraf dosya girişini açan işlev (PhotoPickerProvider verir). */
export const PickerContext = createContext<() => void>(() => {})

export const usePhotoPicker = () => useContext(PickerContext)

/** Yüklü fotoğrafın güvenli adresi (yalnız gömülü görsel çizilir: uzak adres tarayıcıya istek attırır). */
export function safePhoto(photo: string | null | undefined): string | null {
  return isSafePhoto(photo) ? (photo ?? null) : null
}
