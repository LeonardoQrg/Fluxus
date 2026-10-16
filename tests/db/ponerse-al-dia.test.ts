// Ponerme al día y Empezar de cero
import { describe, expect, it } from 'vitest';
import { DbError, newUser, Session, today } from './helpers';

async function code(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as DbError).detail;
  }
  return 'sin error';
}

async function setup() {
  const s = await newUser();
  const banco = await s.createMoney('Banco', 1_000_000);
  const efectivo = await s.createMoney('Efectivo', 200_000);
  const visa = await s.createOwe('Visa', 300_000);
  return { s, banco, efectivo, visa };
}

const adjustments = async (s: Session) =>
  (await s.query(`select 1 from public.movements where description = 'Ajuste: ponerme al día'`)).length;

const report = async (s: Session) => {
  const [t] = await s.query<{ income: string; expense: string }>(
    `select coalesce(sum(income),0) income, coalesce(sum(expense),0) expense from public.report_month`,
  );
  return { income: Number(t.income), expense: Number(t.expense) };
};

describe('Ponerme al día', () => {
  it('ajusta de una vez dinero y deudas: baja = gasto sin detallar, sube = ingreso, deuda = ajuste', async () => {
    const { s, banco, efectivo, visa } = await setup();
    const n = await s.rpc<number>('catch_up', {
      p_items: [
        { account_id: banco, amount: 700_000 }, // bajó 300.000
        { account_id: efectivo, amount: 250_000 }, // subió 50.000
        { account_id: visa, amount: 450_000 }, // la deuda subió 150.000
      ],
    });
    expect(n).toBe(3);
    expect(await s.balance(banco)).toBe(700_000);
    expect(await s.balance(efectivo)).toBe(250_000);
    expect(await s.balance(visa)).toBe(450_000);

    const movs = await s.query<{ type: string; amount: string; description: string }>(
      `select type, amount, description from public.movements where description = 'Ajuste: ponerme al día' order by type`,
    );
    expect(movs.map((m) => m.type)).toEqual(['ajuste_pagar', 'gasto', 'ingreso']);

    // El gasto quedó en la categoría "Sin detallar"; la deuda no cuenta como gasto
    const [cat] = await s.query<{ name: string; total: string }>(
      `select c.name, r.total from public.report_category_month r join public.categories c on c.id = r.category_id`,
    );
    expect(cat).toEqual({ name: 'Sin detallar', total: '300000' });
    expect(await report(s)).toEqual({ income: 50_000, expense: 300_000 });
  });

  it('las cuentas que no cambian no generan movimientos; si no cambia nada, avisa', async () => {
    const { s, banco, efectivo } = await setup();
    expect(await code(s.rpc('catch_up', { p_items: [{ account_id: banco, amount: 1_000_000 }] }))).toBe('sin_cambios');
    await s.rpc('catch_up', { p_items: [{ account_id: banco, amount: 1_000_000 }, { account_id: efectivo, amount: 1 }] });
    expect(await adjustments(s)).toBe(1);
  });

  it('si el dinero solo sube no se crea la categoría "Sin detallar"', async () => {
    const { s, banco } = await setup();
    await s.rpc('catch_up', { p_items: [{ account_id: banco, amount: 2_000_000 }] });
    expect(await s.query(`select 1 from public.categories where name = 'Sin detallar'`)).toHaveLength(0);
  });

  it('valida montos, cuentas repetidas, cuentas ajenas y todo o nada', async () => {
    const { s, banco, efectivo } = await setup();
    const otra = await newUser();
    const ajena = await otra.createMoney('Banco', 5);

    expect(await code(s.rpc('catch_up', { p_items: [{ account_id: banco, amount: -1 }] }))).toBe('monto_negativo');
    expect(await code(s.rpc('catch_up', { p_items: [{ account_id: banco, amount: 10.5 }] }))).toBe('monto_negativo');
    expect(await code(s.rpc('catch_up', { p_items: [{ account_id: banco, amount: 'a' }] }))).toBe('dato_invalido');
    expect(await code(s.rpc('catch_up', { p_items: [] }))).toBe('sin_cambios');
    expect(
      await code(s.rpc('catch_up', { p_items: [{ account_id: banco, amount: 1 }, { account_id: banco, amount: 2 }] })),
    ).toBe('cuenta_repetida');
    expect(await code(s.rpc('catch_up', { p_items: [{ account_id: ajena, amount: 1 }] }))).toBe('cuenta_inexistente');

    // Todo o nada: la segunda cuenta es ajena, así que la primera tampoco se cambia
    expect(
      await code(s.rpc('catch_up', { p_items: [{ account_id: efectivo, amount: 1 }, { account_id: ajena, amount: 1 }] })),
    ).toBe('cuenta_inexistente');
    expect(await s.balance(efectivo)).toBe(200_000);
    expect(await adjustments(s)).toBe(0);
  });

  it('sin sesión no se puede', async () => {
    expect(await code(new Session(null).rpc('catch_up', { p_items: [] }))).toBe('sin_sesion');
  });
});

describe('Empezar de cero', () => {
  it('borra cuentas, movimientos y categorías propias, restaura las 6 categorías y reinicia la configuración', async () => {
    const { s, banco, visa } = await setup();
    await s.rpc('register_movement', {
      p_type: 'gasto',
      p_date: today(),
      p_amount: 1_000,
      p_category_id: await s.categoryId('Salud'),
      p_parts: [{ account_id: banco, amount: 400 }, { account_id: visa, amount: 600 }],
    });
    await s.query(`insert into public.categories (name) values ('Mascotas')`);
    await s.query(`update public.profiles set name = 'Ana', currency = 'USD', onboarding_step = 'done', hide_owe_tip = true`);

    await s.rpc('reset_my_data');

    expect(await s.query('select 1 from public.accounts')).toHaveLength(0);
    expect(await s.query('select 1 from public.movements')).toHaveLength(0);
    expect(await s.query('select 1 from public.movement_parts')).toHaveLength(0);
    const cats = await s.query<{ name: string; sort_order: number }>('select name, sort_order from public.categories order by sort_order');
    expect(cats.map((c) => c.name)).toEqual(['Alimentación', 'Salud', 'Educación', 'Servicios', 'Solidaridad', 'Ocio / Recreación']);
    expect(await s.query('select name, currency, onboarding_step, hide_owe_tip from public.profiles')).toEqual([
      { name: 'Ana', currency: 'USD', onboarding_step: 'intro', hide_owe_tip: false },
    ]);

    // Y se puede volver a cargar todo, incluso cambiando de moneda
    await s.query(`update public.profiles set currency = 'CLP'`);
    const nueva = await s.rpc<string>('save_initial_account', { p_id: null, p_name: 'Banco', p_amount: 5 });
    expect(await s.balance(nueva)).toBe(5);
  });

  it('no toca los datos de otras personas', async () => {
    const ana = await newUser();
    const beto = await newUser();
    const cuenta = await beto.createMoney('Banco', 777);
    await ana.createMoney('Banco', 1);
    await ana.rpc('reset_my_data');
    expect(await beto.balance(cuenta)).toBe(777);
    expect(await beto.query('select 1 from public.categories')).toHaveLength(6);
  });

  it('sin sesión no se puede', async () => {
    expect(await code(new Session(null).rpc('reset_my_data'))).toBe('sin_sesion');
  });
});
