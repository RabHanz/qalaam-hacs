/**
 * Qalaam tajweed color palette.
 *
 * Per strategy §11.4: Qalaam ships its own NEUTRAL palette + a legend modal,
 * deliberately NOT copying Dar al-Maarifah's "Tajweed Quran" registered palette.
 *
 * Rule names match `quran-tajweed`'s 17-rule catalog (see
 * `packages/data-loader/src/quran-tajweed/index.ts`).
 */
import type { TajweedRule } from '@qalaam/data-loader';

// Calm, professional palette — works on cream background. Verified WCAG AA on cream-100.
export const TAJWEED_COLORS: Record<TajweedRule, string> = {
  ham_wasl: '#7a8b97',
  laam_shamsiyah: '#7a8b97',
  madda_normal: '#1f6f7a',
  madda_permissible: '#23808a',
  madda_necessary: '#0e5560',
  madda_obligatory: '#0a464f',
  qalqalah: '#a85a2c',
  ikhfa_shafawi: '#7a4d8c',
  ikhfa: '#5e3877',
  idgham_shafawi: '#3f7a3a',
  idgham_with_ghunnah: '#357032',
  idgham_without_ghunnah: '#2f6531',
  idgham_mutamathilain: '#2a5a2c',
  idgham_mutajanisain: '#26512a',
  idgham_mutaqaribain: '#224a28',
  iqlab: '#b56a16',
  silent: 'rgba(122, 139, 151, 0.5)',
};

export const TAJWEED_LABELS: Record<TajweedRule, string> = {
  ham_wasl: 'Hamzat al-Waṣl',
  laam_shamsiyah: 'Lām Shamsiyyah',
  madda_normal: 'Madd Ṭabī‘ī (2)',
  madda_permissible: 'Madd Munfaṣil (4-5)',
  madda_necessary: 'Madd Lāzim (6)',
  madda_obligatory: 'Madd Wājib Muttaṣil (4-5)',
  qalqalah: 'Qalqalah',
  ikhfa_shafawi: 'Ikhfāʾ Shafawī',
  ikhfa: 'Ikhfāʾ Ḥaqīqī',
  idgham_shafawi: 'Idghām Shafawī',
  idgham_with_ghunnah: 'Idghām with Ghunnah',
  idgham_without_ghunnah: 'Idghām without Ghunnah',
  idgham_mutamathilain: 'Idghām Mutamāthilain',
  idgham_mutajanisain: 'Idghām Mutajānisain',
  idgham_mutaqaribain: 'Idghām Mutaqāribain',
  iqlab: 'Iqlāb',
  silent: 'Silent',
};
