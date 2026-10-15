/** Correo con forma válida: algo@algo.xx */
export const emailOk = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
