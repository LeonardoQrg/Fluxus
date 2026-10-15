/** Texto sin tildes y en minúsculas, para buscar sin importar cómo se escribió */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
