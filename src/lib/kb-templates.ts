/** Шаблоните за документи (файловете са в public/templates/, генерират се със scripts/make-kb-templates.ts). */
export const TEMPLATES = [
  { file: "shablon-produkt.docx", label: "Шаблон: продукт" },
  { file: "shablon-procedura.docx", label: "Шаблон: процедура" },
  { file: "shablon-chzv.docx", label: "Шаблон: правила / ЧЗВ / фирмена информация" },
  { file: "primer-izi-maks.docx", label: "Попълнен образец (примерни данни)" },
] as const;
