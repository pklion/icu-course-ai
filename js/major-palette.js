/**
 * Major Palette Resolver: Maps ICU majors & common subjects to a cohesive,
 * pastel vintage-ish color palette that harmonizes with the Zen Neumorphic aesthetic.
 */

export const PALETTES = [
  'sage',
  'terracotta',
  'ochre',
  'slate',
  'rose',
  'wisteria',
  'teal',
  'amber',
  'indigo',
  'plum',
  'coral',
  'olive',
  'parchment',
  'periwinkle',
];

export const MAJOR_TO_PALETTE = {
  // Natural Sciences & Environment
  'BIO': 'sage',
  'ENV': 'sage',
  'GEN': 'sage',

  // Social & Behavioral Sciences
  'SOC': 'terracotta',
  'EMS': 'terracotta',
  'EDU': 'terracotta',
  'GES': 'terracotta',

  // Economics & Development
  'ECO': 'ochre',
  'DPS': 'ochre',
  'CED': 'ochre',

  // Formal Sciences & Physics/Chemistry
  'MTH': 'slate',
  'PHY': 'slate',
  'CHM': 'slate',

  // Humanities, History & Literature
  'LIT': 'rose',
  'HST': 'rose',
  'CTP': 'rose',
  'GEL': 'rose',

  // Language & Linguistics
  'ELA': 'wisteria',
  'JLP': 'wisteria',
  'ELG': 'wisteria',
  'LED': 'wisteria',
  'LNG': 'wisteria',
  'W':   'wisteria', // All World Languages (WAB, WCN, WFR, etc.)

  // Technology & Global Systems
  'ISC': 'teal',
  'GLS': 'teal',
  'TCP': 'teal',

  // Business & Legal/Asian Studies
  'BUS': 'amber',
  'AST': 'amber',
  'LAW': 'amber',

  // Political Science & International Relations
  'POL': 'indigo',
  'PPL': 'indigo',
  'AMS': 'indigo',
  'IRL': 'indigo',

  // Arts, Philosophy & Gender Studies
  'PHR': 'plum',
  'ARC': 'plum',
  'GSS': 'plum',

  // Music, Media & Expression
  'MUS': 'coral',
  'MCC': 'coral',

  // Physical Education & Peace/Community
  'HPE': 'olive',
  'PCS': 'olive',
  'SLR': 'olive',

  // Cultural Studies & Japanese Studies
  'ANT': 'parchment',
  'JPS': 'parchment',
  'GEH': 'parchment',

  // Psychological Sciences & Interdisciplinary
  'PSY': 'periwinkle',
  'GEX': 'periwinkle',
  'STH': 'periwinkle',
};

/**
 * Extract normalized prefix key from a course or code string.
 */
export function getMajorPrefix(courseOrCode) {
  const code = (typeof courseOrCode === 'string' ? courseOrCode : courseOrCode?.code || '').toUpperCase();
  if (code.startsWith('W')) return 'W';

  const match = code.match(/^([A-Z]+)/);
  return match ? match[1] : '';
}

/**
 * Determine the pastel vintage palette key for a course.
 */
export function getCoursePalette(courseOrCode) {
  const prefix = getMajorPrefix(courseOrCode);
  if (MAJOR_TO_PALETTE[prefix]) {
    return MAJOR_TO_PALETTE[prefix];
  }

  // Deterministic fallback hash for any unexpected prefix
  if (!prefix) return 'slate';
  let hash = 0;
  for (let i = 0; i < prefix.length; i++) {
    hash = ((hash << 5) - hash) + prefix.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}
