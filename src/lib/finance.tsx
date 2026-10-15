// Los datos de la persona (cuentas, categorías y movimientos), compartidos por todas las pantallas.
// Después de cada cambio se vuelven a cargar con refresh().
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  errorMessage,
  listAccounts,
  listCategories,
  listMovements,
  type Account,
  type Category,
  type Movement,
} from './data';

type Finance = {
  loaded: boolean;
  error: string | null;
  accounts: Account[];
  categories: Category[];
  movements: Movement[];
  refresh: () => Promise<void>;
  /** Cuentas activas de dinero */
  money: Account[];
  /** Cuentas activas por pagar */
  owe: Account[];
  totalMoney: number;
  totalOwe: number;
  accountById: (id: string | null | undefined) => Account | undefined;
  categoryById: (id: string | null | undefined) => Category | undefined;
};

const FinanceContext = createContext<Finance | null>(null);

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance tiene que usarse dentro de <FinanceProvider>');
  return ctx;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, c, m] = await Promise.all([listAccounts(), listCategories(), listMovements()]);
      setAccounts(a);
      setCategories(c);
      setMovements(m);
      setError(null);
      setLoaded(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    Promise.all([listAccounts(), listCategories(), listMovements()])
      .then(([a, c, m]) => {
        setAccounts(a);
        setCategories(c);
        setMovements(m);
        setLoaded(true);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const value = useMemo<Finance>(() => {
    const active = accounts.filter((a) => !a.deleted_at);
    const money = active.filter((a) => a.kind === 'dinero');
    const owe = active.filter((a) => a.kind === 'pagar');
    const accMap = new Map(accounts.map((a) => [a.id, a]));
    const catMap = new Map(categories.map((c) => [c.id, c]));
    return {
      loaded,
      error,
      accounts,
      categories,
      movements,
      refresh,
      money,
      owe,
      totalMoney: money.reduce((t, a) => t + a.amount, 0),
      totalOwe: owe.reduce((t, a) => t + a.amount, 0),
      accountById: (id) => (id ? accMap.get(id) : undefined),
      categoryById: (id) => (id ? catMap.get(id) : undefined),
    };
  }, [accounts, categories, movements, loaded, error, refresh]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

/** Ids de todas las cuentas que toca un movimiento */
export function movementAccountIds(m: Movement): string[] {
  return [m.account_id, m.from_account_id, m.to_account_id, ...m.parts.map((p) => p.account_id)].filter(
    (x): x is string => !!x,
  );
}

/**
 * Saldo que tendría cada cuenta si se revirtiera `old` (para editar un movimiento):
 * así el formulario muestra cuánto hay disponible de verdad.
 */
export function balancesWithout(accounts: Account[], old: Movement | null): Map<string, number> {
  const out = new Map(accounts.map((a) => [a.id, a.amount]));
  if (!old) return out;
  const add = (id: string | null, v: number) => {
    if (id && out.has(id)) out.set(id, (out.get(id) ?? 0) + v);
  };
  const kind = new Map(accounts.map((a) => [a.id, a.kind]));
  switch (old.type) {
    case 'ingreso':
      add(old.account_id, -old.amount);
      break;
    case 'gasto':
      for (const p of old.parts) add(p.account_id, kind.get(p.account_id) === 'dinero' ? p.amount : -p.amount);
      break;
    case 'pago':
      add(old.from_account_id, old.amount);
      add(old.to_account_id, old.amount);
      break;
    case 'transfer':
      add(old.from_account_id, old.amount);
      add(old.to_account_id, -old.amount);
      break;
    case 'nuevo_pagar':
      add(old.to_account_id, -old.amount);
      break;
    case 'ajuste_pagar':
      add(old.to_account_id, -(old.delta ?? 0));
      break;
  }
  return out;
}
