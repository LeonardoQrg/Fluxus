// Cómo se muestra cada movimiento en las listas (título, detalle y monto con color).
import type { Account, Category, Movement } from './data';
import { shortDate } from './dates';
import { formatMoney, type CurrencyCode } from './money';

export type MovementTone = 'in' | 'out' | 'pay';
export type MovementIcon = 'up' | 'down' | 'swap' | 'card';

export type MovementView = {
  tone: MovementTone;
  icon: MovementIcon;
  title: string;
  subtitle: string;
  amount: string;
};

type Lookup = {
  accountById: (id: string | null | undefined) => Account | undefined;
  categoryById: (id: string | null | undefined) => Category | undefined;
};

const name = (l: Lookup, id: string | null) => l.accountById(id)?.name ?? 'Cuenta eliminada';
const join = (...parts: string[]) => parts.filter(Boolean).join(' · ');

/** Movimiento en la lista general */
export function describeMovement(m: Movement, l: Lookup, c: CurrencyCode): MovementView {
  const date = shortDate(m.date);
  const money = (v: number) => formatMoney(v, c);
  switch (m.type) {
    case 'ingreso':
      return { tone: 'in', icon: 'up', title: m.description || 'Ingreso', subtitle: join(name(l, m.account_id), date), amount: `+${money(m.amount)}` };
    case 'gasto': {
      const cat = l.categoryById(m.category_id)?.name ?? 'Gasto';
      const via = m.parts
        .map((p) => (m.parts.length > 1 ? `${name(l, p.account_id)} ${money(p.amount)}` : name(l, p.account_id)))
        .join(' + ');
      return {
        tone: 'out',
        icon: 'down',
        title: m.description || cat,
        subtitle: join(m.description ? cat : '', via, date),
        amount: `−${money(m.amount)}`,
      };
    }
    case 'pago':
      return { tone: 'pay', icon: 'swap', title: `Pago de ${name(l, m.to_account_id)}`, subtitle: join(`Desde ${name(l, m.from_account_id)}`, date), amount: money(m.amount) };
    case 'transfer':
      return {
        tone: 'pay',
        icon: 'swap',
        title: m.description || 'Transferencia',
        subtitle: join(`${name(l, m.from_account_id)} → ${name(l, m.to_account_id)}`, date),
        amount: money(m.amount),
      };
    case 'nuevo_pagar':
      return { tone: 'pay', icon: 'card', title: `Anotado por pagar: ${name(l, m.to_account_id)}`, subtitle: date, amount: money(m.amount) };
    case 'ajuste_pagar':
      return {
        tone: 'pay',
        icon: 'card',
        title: `Monto actualizado: ${name(l, m.to_account_id)}`,
        subtitle: join(m.description, date),
        amount: `${(m.delta ?? 0) > 0 ? '+' : '−'}${money(Math.abs(m.delta ?? 0))}`,
      };
  }
}

/** Movimiento visto desde una cuenta: muestra lo que le pasó a esa cuenta */
export function describeForAccount(m: Movement, account: Account, l: Lookup, c: CurrencyCode): MovementView {
  const date = shortDate(m.date);
  const money = (v: number) => formatMoney(v, c);
  const isMoney = account.kind === 'dinero';
  switch (m.type) {
    case 'ingreso':
      return { tone: 'in', icon: 'up', title: m.description || 'Ingreso', subtitle: date, amount: `+${money(m.amount)}` };
    case 'gasto': {
      const part = m.parts.find((p) => p.account_id === account.id)?.amount ?? m.amount;
      const cat = l.categoryById(m.category_id)?.name ?? 'Gasto';
      const shared = m.parts.length > 1 ? `compartido, total ${money(m.amount)}` : '';
      return {
        tone: 'out',
        icon: 'down',
        title: m.description || cat,
        subtitle: join(m.description ? cat : '', shared, date),
        amount: `${isMoney ? '−' : '+'}${money(part)}`,
      };
    }
    case 'pago':
      return {
        tone: 'pay',
        icon: 'swap',
        title: m.from_account_id === account.id ? `Pago de ${name(l, m.to_account_id)}` : `Pago desde ${name(l, m.from_account_id)}`,
        subtitle: date,
        amount: `−${money(m.amount)}`,
      };
    case 'transfer': {
      const out = m.from_account_id === account.id;
      return {
        tone: out ? 'out' : 'in',
        icon: 'swap',
        title: out ? `Transferencia a ${name(l, m.to_account_id)}` : `Transferencia desde ${name(l, m.from_account_id)}`,
        subtitle: join(m.description, date),
        amount: `${out ? '−' : '+'}${money(m.amount)}`,
      };
    }
    case 'nuevo_pagar':
      return { tone: 'pay', icon: 'card', title: 'Anotado por pagar', subtitle: date, amount: money(m.amount) };
    case 'ajuste_pagar':
      return {
        tone: 'pay',
        icon: 'card',
        title: 'Monto actualizado',
        subtitle: join(m.description, date),
        amount: `${(m.delta ?? 0) > 0 ? '+' : '−'}${money(Math.abs(m.delta ?? 0))}`,
      };
  }
}

/** Cuánto movió este movimiento en una cuenta, con signo (para totales filtrados por cuenta) */
export function effectOnAccount(m: Movement, account: Account): number {
  switch (m.type) {
    case 'ingreso':
      return m.account_id === account.id ? m.amount : 0;
    case 'gasto':
      return m.parts.find((p) => p.account_id === account.id)?.amount ?? 0;
    default:
      return 0;
  }
}
