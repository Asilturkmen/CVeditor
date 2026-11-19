// jsdom kendi tür bildirimini taşımıyor (@types/jsdom kurulu değil); sunucunun kullandığı kadarı.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string)
    readonly window: Window & typeof globalThis
  }
}
