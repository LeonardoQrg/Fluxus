// Colores de Fluxus (estilo "Azul medianoche"). Turquesa es la marca,
// verde es lo que entra, rojo coral es lo que sale.
export const colors = {
  background: '#0B1226',
  surface: '#111A38',
  highlight: '#16224A',
  highlightBorder: '#263770',
  border: '#1F2C5A',
  text: '#EAF0FF',
  textMuted: '#8D9BC4',
  accent: '#4FE3D4',
  onAccent: '#0B1226',
  income: '#4ADE9A',
  expense: '#FF6F91',
  warning: '#F5C26B',
  warningBackground: '#33291A',
  disabled: '#24305A',
  onDisabled: '#6F7DA8',
} as const;

/** Colores de categorías en los gráficos, fijos por el orden de la categoría */
export const categoryColors = ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181', '#008300', '#9085E9', '#E66767'];
export const otherCategoryColor = '#566176';

export const categoryColor = (sortOrder: number) => categoryColors[sortOrder] ?? otherCategoryColor;

/** Tipografía Sora. En Android cada grosor es un archivo distinto, por eso se elige por nombre. */
export const fonts = {
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semibold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extrabold: 'Sora_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fonts;

/** Fondos suaves para avisos (de los colores del prototipo) */
export const soft = {
  accent: '#123545',
  income: '#11322C',
  expense: '#3A1832',
  surface2: '#0E1630',
} as const;

export const radius = { field: 12, card: 18 } as const;
