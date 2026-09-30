/** Категории на качените документи. Отделен файл, за да може да се ползва и от клиентски компоненти. */
export const KB_CATEGORIES = [
  "продукт",
  "процедура",
  "политика",
  "фирмена информация",
] as const;
export type KbCategory = (typeof KB_CATEGORIES)[number];
