import { describe, expect, it } from 'vitest'
import { buildContactMasks, createMasker, findAddresses, hasPlaceholder, hasUnknownPlaceholder, isPhone, phonesIn } from './mask'

/**
 * Gizlilik incelemesinin (2026-11-19) bulguları: telefon biçimleri, aksanlı
 * adlar, deseni olan kişisel bilgiler (adres, doğum tarihi, kimlik no,
 * kullanıcı adı, "[at]" e-postası), sözcük sınırı, metindeki hazır yer
 * tutucu ve bozulmuş yer tutucu. Her test: bulgudaki girdi → beklenen çıktı.
 * Bütün kişiler ve numaralar uydurmadır.
 */

const generic = () => createMasker(buildContactMasks({}))
/** Maskeler, geri koymanın kayıpsız olduğunu doğrular, maskeli metni döndürür. */
function roundTrip(text: string, source: Parameters<typeof buildContactMasks>[0] = {}): string {
  const masker = createMasker(buildContactMasks(source))
  const masked = masker.mask(text)
  expect(masker.unmask(masked), text).toBe(text)
  expect(masker.restore(masked), text).toBe(text)
  return masked
}

/** Sağlaması tutan uydurma TC kimlik no (ilk 9 hane verilir; kaynakta hazır numara durmasın diye hesaplanır). */
function fakeTc(first9: string): string {
  const d = first9.split('').map(Number)
  const d10 = (((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10 + 10) % 10
  const d11 = (d.reduce((a, b) => a + b, 0) + d10) % 10
  return `${first9}${d10}${d11}`
}

describe('telefon: biçimler', () => {
  it.each([
    '0(532) 123 45 67',
    '(0 532) 123 45 67',
    '212 123 45 67',
    '415-555-0132',
    '+90 532 123 45 67',
    '0532 123 45 67',
    '(0532) 123-45-67',
    '+1 (415) 555-0132',
    '+44 20 7946 0958',
    '020 7946 0958',
    '+905321234567',
    '0532.123.45.67',
  ])('%s telefon olarak bulunur ve maskelenir', (phone) => {
    expect(phonesIn(`Tel: ${phone} (cep)`)).toEqual([phone])
    const masked = roundTrip(`Tel: ${phone} (cep)`)
    expect(masked).toMatch(/^Tel: ⟦PHONE_2⟧ \(cep\)$/)
  })

  it('satır sonu ayırıcı değildir: alt satırdaki yıl telefona katılmaz, telefon yine maskelenir', () => {
    expect(phonesIn('+90 532 123 45 67\n2019 - 2023')).toEqual(['+90 532 123 45 67'])
    expect(phonesIn('0532 123 45 67\n2019')).toEqual(['0532 123 45 67'])
    const masked = roundTrip('+90 532 123 45 67\n2019 - 2023\nÖrnek A.Ş.')
    expect(masked).toBe('⟦PHONE_2⟧\n2019 - 2023\nÖrnek A.Ş.')
    expect(roundTrip('0532 123 45 67\n2019')).toBe('⟦PHONE_2⟧\n2019')
  })

  it.each([
    '2019 - 2023',
    '2019-2023 2024',
    '2015 2016 2017',
    '03.2020 – 05.2022',
    '03.2020 - 05.2022',
    '01.02.2020 03.04.2021',
    '01.02.2020 - 3.4.2021',
    '12.03.1995',
    '2121234567',
    '100 200 30 40',
    '1.250.000 TL 2019',
    'sürüm 10.15.7 2024',
  ])('%s telefon sayılmaz', (text) => {
    expect(phonesIn(text)).toEqual([])
    expect(roundTrip(text)).not.toContain('⟦PHONE')
  })

  it('TC kimlik no biçimindeki 11 hane telefon değildir', () => {
    const tc = fakeTc('100000001')
    expect(isPhone(tc)).toBe(false)
    expect(phonesIn(`No ${tc}`)).toEqual([])
  })
})

describe('aksanlı adlar', () => {
  it.each([
    ['José Álvarez', 'José Álvarez ve JOSÉ ÁLVAREZ; Jose Alvarez; Álvarez, José; J. Álvarez'],
    ['Chloé Dubois', 'Chloé Dubois · CHLOÉ DUBOIS · Chloe Dubois · Dubois'],
    ['André Šimić', 'André Šimić, Andre Simic, ANDRÉ ŠIMIĆ, Šimić'],
    ['Zoë Müller-Çelik', 'Zoë Müller-Çelik; Zoe Muller-Celik; ZOË MÜLLER-ÇELİK'],
    ['Søren Łukasz Đorđević', 'Søren Łukasz Đorđević; Soren Lukasz Dordevic'],
  ])('%s kendi yazımıyla ve aksansız yazımla maskelenir', (name, text) => {
    const masked = roundTrip(text, { fullName: name })
    // Yer tutucular dışında adın hiçbir parçası (3+ harfli sözcük) kalmaz
    expect(masked.replace(/⟦[A-Z_\d]+⟧/g, '')).not.toMatch(/\p{L}{3,}/u)
    expect(masked).toContain('⟦NAME⟧')
  })

  it('ayrıştırılmış (NFD) yazım da eşleşir', () => {
    const nfd = 'José Álvarez'.normalize('NFD')
    expect(roundTrip(`Ben ${nfd}.`, { fullName: 'José Álvarez' })).toBe('Ben ⟦NAME⟧.')
    // Aksanlı e-posta/bağlantı da (ad dışı alanlar) NFD yazımıyla yakalanır
    expect(roundTrip(`Site: ${'andré.example.com'.normalize('NFD')}`, { website: 'andré.example.com' })).toBe('Site: ⟦WEBSITE⟧')
  })

  it('Türkçe İ/ı davranışı bozulmadı', () => {
    const masked = roundTrip('IŞIL İNCİ · ışıl inci · ISIL INCI · Işıl İnci', { fullName: 'Işıl İnci' })
    expect(masked).toBe('⟦NAME⟧ · ⟦NAME_2⟧ · ⟦NAME_3⟧ · ⟦NAME_4⟧')
  })
})

describe('deseni olan kişisel bilgiler', () => {
  it('etiketsiz sokak adresi ⟦ADDRESS⟧ olur', () => {
    const line = 'Atatürk Mah. Çiçek Sok. No:12 D:4 Bornova / İzmir'
    expect(roundTrip(line)).toBe('⟦ADDRESS⟧')
    expect(roundTrip(`Ayşe Yılmaz | ${line} | Frontend Geliştirici`)).toBe('Ayşe Yılmaz | ⟦ADDRESS⟧ | Frontend Geliştirici')
    expect(roundTrip('Adres: Moda Caddesi No: 5 Kat: 3, 34710 Kadıköy/İstanbul')).toBe('Adres: ⟦ADDRESS⟧')
    expect(roundTrip('CUMHURİYET MAHALLESİ 1453. SOKAK NO:7 DAİRE:2')).toBe('⟦ADDRESS⟧')
    expect(roundTrip('Lives at 221 Baker Street, Apt 4, London')).toBe('Lives at ⟦ADDRESS⟧')
    expect(roundTrip('<p>Ofis: Bağdat Cad. No: 100, Kadıköy</p><p>React ile çalıştım.</p>')).toBe('<p>Ofis: ⟦ADDRESS⟧</p><p>React ile çalıştım.</p>')
  })

  it('adres olmayan metin adres sayılmaz', () => {
    for (const text of [
      'Sokak hayvanları için gönüllü çalıştım.',
      'Mahalle derneğinde 3 yıl görev aldım.',
      'Proje No: 12 kapsamında 5 kişilik ekibi yönettim.',
      'Kat ettiğimiz yol: 3 ülke, 12 şehir.',
      'Worked 3 days a week on road safety.',
      '2019 - 2023 Örnek A.Ş., İstanbul',
    ]) {
      expect(findAddresses(text), text).toEqual([])
    }
  })

  it('doğum tarihi yalnız etiketin ardında maskelenir; deneyim tarihleri değil', () => {
    expect(roundTrip('Doğum Tarihi: 12.03.1995')).toBe('Doğum Tarihi: ⟦BIRTHDATE⟧')
    expect(roundTrip('DOĞUM TARİHİ : 12/03/1995')).toBe('DOĞUM TARİHİ : ⟦BIRTHDATE⟧')
    expect(roundTrip('Doğum Yeri ve Tarihi: İzmir, 12 Mart 1995')).toBe('Doğum Yeri ve Tarihi: İzmir, ⟦BIRTHDATE⟧')
    expect(roundTrip('Date of birth: March 12, 1995')).toBe('Date of birth: ⟦BIRTHDATE⟧')
    expect(roundTrip('DOB 1995-03-12')).toContain('⟦BIRTHDATE⟧')
    expect(roundTrip('Born in Izmir in 1995.')).toBe('Born in Izmir in ⟦BIRTHDATE⟧.')
    for (const text of ['03.2020 – 05.2022', '12.03.2021 tarihinde yayına aldım', 'Mart 2020 - Mayıs 2022', 'Doğum izninden sonra 2021 yılında döndüm']) {
      expect(roundTrip(text), text).not.toContain('⟦BIRTHDATE')
    }
  })

  it('TC kimlik no: etiketli ve etiketsiz', () => {
    const tc = fakeTc('100000001')
    expect(roundTrip(`TC Kimlik No: ${tc}`)).toBe('TC Kimlik No: ⟦IDNO⟧')
    expect(roundTrip(`T.C. No: ${tc}`)).toBe('T.C. No: ⟦IDNO⟧')
    expect(roundTrip(`T.C.: ${tc} · Kimlik Numarası ${tc}`)).toBe('T.C.: ⟦IDNO⟧ · Kimlik Numarası ⟦IDNO⟧')
    expect(roundTrip(`${tc} | İzmir`)).toBe('⟦IDNO⟧ | İzmir')
    expect(roundTrip('Passport No: U12345678')).toBe('Passport No: ⟦IDNO⟧')
    // 11 hane değilse (sipariş numarası, yıl dizisi) dokunulmaz
    expect(roundTrip('TCP/IP 2019 ve 123456789012 numaralı kayıt')).not.toContain('⟦IDNO')
  })

  it("URL'siz kullanıcı adı ve sosyal profil bağlantısı", () => {
    expect(roundTrip('LinkedIn: aysecodes | GitHub: @aysecodes')).toBe('LinkedIn: ⟦HANDLE⟧ | GitHub: ⟦HANDLE_2⟧')
    expect(roundTrip('twitter.com/aysecodes')).toBe('⟦PROFILE⟧')
    expect(roundTrip('Bana @aysecodes üzerinden ulaş.')).toBe('Bana ⟦HANDLE⟧ üzerinden ulaş.')
    expect(roundTrip('https://www.linkedin.com/in/mehmet-demir-ornek/ ve instagram.com/aysecodes')).toBe('⟦PROFILE⟧ ve ⟦PROFILE_2⟧')
    // Paket adları ve dekoratörler kullanıcı adı değildir
    expect(roundTrip('@angular/core ve @Component() kullandım; max.com/abc')).toBe('@angular/core ve @Component() kullandım; max.com/abc')
  })

  it('"ad [at] alan [dot] com" biçimi e-posta olarak maskelenir', () => {
    expect(roundTrip('ayse [at] example [dot] com')).toBe('⟦EMAIL_2⟧')
    expect(roundTrip('Yaz: ayse.yilmaz (at) example.com')).toBe('Yaz: ⟦EMAIL_2⟧')
    expect(roundTrip('ayse at example dot com')).toBe('⟦EMAIL_2⟧')
    expect(roundTrip('I worked at example.com for two years')).toBe('I worked at example.com for two years')
  })
})

describe('sözcük sınırı', () => {
  it('yalın kullanıcı adı sıradan sözcüğün içinde maskelenmez', () => {
    const masked = roundTrip('Nasıl yapıldığını anlattım; asil ve github.com/asil; asil@example.com', { github: 'asil' })
    expect(masked).toBe('Nasıl yapıldığını anlattım; ⟦GITHUB⟧ ve github.com/⟦GITHUB⟧; ⟦EMAIL_2⟧')
    expect(roundTrip('kasiler · asiller · Asılsız', { github: 'asil' })).toBe('kasiler · asiller · Asılsız')
  })

  it('bilinen e-posta başka adresin parçası olarak eşleşmez', () => {
    expect(roundTrip('a@b.com ve a@b.co', { email: 'a@b.co' })).toBe('⟦EMAIL_2⟧ ve ⟦EMAIL⟧')
  })
})

describe('metinde zaten duran yer tutucu', () => {
  it('kullanıcının yazdığı ⟦…⟧ kaçışlanır; gerçek değerle çakışmaz, geri koymada yanlış değer yazılmaz', () => {
    const text = 'Bana ⟦EMAIL⟧ yaz ya da a@b.com; ⟦NAME⟧ ve tek ⟦ ayraç'
    const masker = createMasker(buildContactMasks({ email: 'a@b.com', fullName: 'Ayşe Yılmaz' }))
    const masked = masker.mask(text)
    expect(masked).toBe('Bana ⟦RAW⟧ yaz ya da ⟦EMAIL⟧; ⟦RAW_2⟧ ve tek ⟦RAW_3⟧ ayraç')
    expect(masker.unmask(masked)).toBe(text)
    // Model yanıtı: yer tutucular yerelde doğru değerlere döner
    expect(masker.restore('⟦EMAIL⟧ adresine yaz; ⟦RAW⟧ dediğim şablon.')).toBe('a@b.com adresine yaz; ⟦EMAIL⟧ dediğim şablon.')
  })

  it('önceki adımın yer tutucuları (reserved) kaçışlanmaz', () => {
    const masker = createMasker(buildContactMasks({ fullName: 'Ayşe Yılmaz' }), { reserved: ['⟦EMAIL⟧'] })
    expect(masker.mask('Ayşe Yılmaz · ⟦EMAIL⟧ · ⟦PHONE⟧')).toBe('⟦NAME⟧ · ⟦EMAIL⟧ · ⟦RAW⟧')
  })
})

describe('bozulmuş ya da tanınmayan yer tutucu', () => {
  const known = ['⟦NAME⟧', '⟦EMAIL⟧', '⟦PHONE_2⟧']

  it.each(['⟦İSİM⟧', '⟦E-POSTA⟧', '⟦Name⟧', '⟦NAME 2⟧', '[EMAIL]', '⟦EMAIL', 'EMAIL⟧', '{NAME}', '<PHONE_2>', '⟦PHONE⟧', '⟦NAME_2⟧', '⟦RAW⟧'])(
    '%s reddedilir',
    (bad) => {
      expect(hasUnknownPlaceholder(`Bana ${bad} üzerinden ulaşın.`, known)).toBe(true)
    },
  )

  it('gönderilen yer tutucular ve sıradan köşeli ayraçlar kabul edilir', () => {
    expect(hasUnknownPlaceholder('⟦NAME⟧, ⟦EMAIL⟧ ve ⟦PHONE_2⟧ [1] {x} <strong>EMAIL</strong>', known)).toBe(false)
    // Gönderilmeyen türün köşeli yazımı yer tutucu sayılmaz
    expect(hasUnknownPlaceholder('[LOCATION] şablon değişkeni', known)).toBe(false)
    expect(hasUnknownPlaceholder('düz metin', [])).toBe(false)
  })

  it('restore: bozuk yer tutucuda null; hasPlaceholder her ayracı yakalar', () => {
    const masker = generic()
    masker.mask('a@b.com')
    expect(masker.restore('⟦EMAIL_2⟧')).toBe('a@b.com')
    expect(masker.restore('⟦E-POSTA⟧')).toBeNull()
    expect(masker.restore('[EMAIL_2]')).toBeNull()
    expect(hasPlaceholder('⟦İSİM⟧')).toBe(true)
    expect(hasPlaceholder('⟦EMAIL')).toBe(true)
    expect(hasPlaceholder('[EMAIL]')).toBe(false)
  })
})
