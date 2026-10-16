import type { SectionType } from '@/cv/schema'
import { m } from '@/paraglide/messages'

export type FieldKind = 'text' | 'url' | 'email' | 'tel' | 'rich' | 'range' | 'month'

export interface FieldDef {
  key: string
  kind: FieldKind
  label: () => string
  /** Boş alanda görünen örnek ipucu */
  placeholder?: () => string
  /** İki sütunluk ızgarada tam genişlik */
  wide?: boolean
}

/**
 * Bölüm türüne göre kayıt alanları. Alan anahtarları şemadaki adlarla
 * aynıdır; yeni alan eklemek = şema + burası + CvMarkup.
 */
export const ITEM_FIELDS: Record<Exclude<SectionType, 'summary'>, FieldDef[]> = {
  experience: [
    { key: 'position', kind: 'text', label: () => m.f_position(), placeholder: () => m.ph_position() },
    { key: 'company', kind: 'text', label: () => m.f_company(), placeholder: () => m.ph_company() },
    { key: 'location', kind: 'text', label: () => m.f_location(), placeholder: () => m.ph_location() },
    { key: 'dates', kind: 'range', label: () => m.f_dates(), wide: true },
    { key: 'description', kind: 'rich', label: () => m.f_description(), placeholder: () => m.ph_experience_desc(), wide: true },
  ],
  education: [
    { key: 'school', kind: 'text', label: () => m.f_school(), placeholder: () => m.ph_school() },
    { key: 'degree', kind: 'text', label: () => m.f_degree(), placeholder: () => m.ph_degree() },
    { key: 'field', kind: 'text', label: () => m.f_field(), placeholder: () => m.ph_field() },
    { key: 'location', kind: 'text', label: () => m.f_location(), placeholder: () => m.ph_location() },
    { key: 'grade', kind: 'text', label: () => m.f_grade(), placeholder: () => m.ph_grade() },
    { key: 'dates', kind: 'range', label: () => m.f_dates(), wide: true },
    { key: 'description', kind: 'rich', label: () => m.f_description(), placeholder: () => m.ph_education_desc(), wide: true },
  ],
  projects: [
    { key: 'name', kind: 'text', label: () => m.f_project_name(), placeholder: () => m.ph_project_name() },
    { key: 'role', kind: 'text', label: () => m.f_role(), placeholder: () => m.ph_project_role() },
    { key: 'url', kind: 'url', label: () => m.f_url(), placeholder: () => m.ph_url(), wide: true },
    { key: 'dates', kind: 'range', label: () => m.f_dates(), wide: true },
    { key: 'description', kind: 'rich', label: () => m.f_description(), placeholder: () => m.ph_project_desc(), wide: true },
  ],
  skills: [
    { key: 'name', kind: 'text', label: () => m.f_skill_group(), placeholder: () => m.ph_skill_group() },
    { key: 'keywords', kind: 'text', label: () => m.f_skill_keywords(), placeholder: () => m.ph_skill_keywords(), wide: true },
  ],
  languages: [
    { key: 'name', kind: 'text', label: () => m.f_language(), placeholder: () => m.ph_language() },
    { key: 'level', kind: 'text', label: () => m.f_level(), placeholder: () => m.ph_level() },
  ],
  certificates: [
    { key: 'name', kind: 'text', label: () => m.f_certificate(), placeholder: () => m.ph_certificate() },
    { key: 'issuer', kind: 'text', label: () => m.f_issuer(), placeholder: () => m.ph_issuer() },
    { key: 'date', kind: 'month', label: () => m.f_date() },
    { key: 'url', kind: 'url', label: () => m.f_url(), placeholder: () => m.ph_certificate_url() },
  ],
  awards: [
    { key: 'title', kind: 'text', label: () => m.f_award(), placeholder: () => m.ph_award() },
    { key: 'issuer', kind: 'text', label: () => m.f_issuer(), placeholder: () => m.ph_issuer() },
    { key: 'date', kind: 'month', label: () => m.f_date() },
    { key: 'description', kind: 'rich', label: () => m.f_description(), placeholder: () => m.ph_award_desc(), wide: true },
  ],
  volunteer: [
    { key: 'role', kind: 'text', label: () => m.f_role(), placeholder: () => m.ph_volunteer_role() },
    { key: 'organization', kind: 'text', label: () => m.f_organization(), placeholder: () => m.ph_organization() },
    { key: 'location', kind: 'text', label: () => m.f_location(), placeholder: () => m.ph_location() },
    { key: 'dates', kind: 'range', label: () => m.f_dates(), wide: true },
    { key: 'description', kind: 'rich', label: () => m.f_description(), placeholder: () => m.ph_volunteer_desc(), wide: true },
  ],
  references: [
    { key: 'name', kind: 'text', label: () => m.f_full_name(), placeholder: () => m.ph_reference_name() },
    { key: 'position', kind: 'text', label: () => m.f_position(), placeholder: () => m.ph_reference_position() },
    { key: 'organization', kind: 'text', label: () => m.f_organization(), placeholder: () => m.ph_company() },
    { key: 'email', kind: 'email', label: () => m.f_email(), placeholder: () => m.ph_email() },
    { key: 'phone', kind: 'tel', label: () => m.f_phone(), placeholder: () => m.ph_phone() },
  ],
  custom: [
    { key: 'title', kind: 'text', label: () => m.f_title(), placeholder: () => m.ph_custom_title() },
    { key: 'subtitle', kind: 'text', label: () => m.f_subtitle(), placeholder: () => m.ph_custom_subtitle() },
    { key: 'location', kind: 'text', label: () => m.f_location(), placeholder: () => m.ph_location() },
    { key: 'url', kind: 'url', label: () => m.f_url(), placeholder: () => m.ph_url() },
    { key: 'dates', kind: 'range', label: () => m.f_dates(), wide: true },
    { key: 'description', kind: 'rich', label: () => m.f_description(), placeholder: () => m.ph_custom_desc(), wide: true },
  ],
}

export const SECTION_LABELS: Record<SectionType, () => string> = {
  summary: () => m.s_summary(),
  experience: () => m.s_experience(),
  education: () => m.s_education(),
  projects: () => m.s_projects(),
  skills: () => m.s_skills(),
  languages: () => m.s_languages(),
  certificates: () => m.s_certificates(),
  awards: () => m.s_awards(),
  volunteer: () => m.s_volunteer(),
  references: () => m.s_references(),
  custom: () => m.s_custom(),
}

/** "+ Deneyim ekle" gibi düğme metinleri */
export const ADD_ITEM_LABELS: Record<SectionType, () => string> = {
  summary: () => m.add_summary(),
  experience: () => m.add_experience(),
  education: () => m.add_education(),
  projects: () => m.add_project(),
  skills: () => m.add_skill(),
  languages: () => m.add_language(),
  certificates: () => m.add_certificate(),
  awards: () => m.add_award(),
  volunteer: () => m.add_volunteer(),
  references: () => m.add_reference(),
  custom: () => m.add_custom_item(),
}
