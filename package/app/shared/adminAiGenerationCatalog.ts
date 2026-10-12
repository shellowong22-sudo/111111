export const ADMIN_AI_GENERATION_CATALOG_CODES = [
  'TOP', 'BTDY', 'FRNT', 'CN', 'READ', 'NI', 'NH', 'FIRS', 'BI', 'BECO', 'DAYB', 'MAG', 'MDIA', 'MEDI',
  '3RD', 'INTL', 'CMNT', 'OPIN', 'BNEF', 'PERS', 'MYN', 'NLRT', 'NSUB', 'MREP', 'NZPD', 'SOCL', 'SOCI', 'TREN',
] as const;

export type AdminAiGenerationCatalogCode = (typeof ADMIN_AI_GENERATION_CATALOG_CODES)[number];

export const ADMIN_AI_GENERATION_CATALOG_STATUSES = ['enabled', 'disabled', 'deleted'] as const;
export type AdminAiGenerationCatalogStatus = (typeof ADMIN_AI_GENERATION_CATALOG_STATUSES)[number];

export const ADMIN_AI_GENERATION_CATALOG_ACTIONS = ['enabled', 'disabled', 'deleted'] as const;
export type AdminAiGenerationCatalogAction = (typeof ADMIN_AI_GENERATION_CATALOG_ACTIONS)[number];

export const ADMIN_AI_GENERATION_TEMPLATE_BY_CATALOG_CODE = {
  TOP: 'news', BTDY: 'news', FRNT: 'news', CN: 'news', READ: 'news', NI: 'news', NH: 'news', FIRS: 'news',
  BI: 'report', BECO: 'report', DAYB: 'news', MAG: 'news', MDIA: 'news', MEDI: 'news', '3RD': 'news', INTL: 'news',
  CMNT: 'report', OPIN: 'report', BNEF: 'report', PERS: 'news', MYN: 'news', NLRT: 'news', NSUB: 'news',
  MREP: 'report', NZPD: 'news', SOCL: 'report', SOCI: 'report', TREN: 'report',
} as const satisfies Record<AdminAiGenerationCatalogCode, 'news' | 'report'>;

export function getAdminAiGenerationTemplate(catalogCode: AdminAiGenerationCatalogCode) {
  return ADMIN_AI_GENERATION_TEMPLATE_BY_CATALOG_CODE[catalogCode];
}
