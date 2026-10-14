// Pruebas de las "Reglas de saldos" de la especificación.
// Los montos están en centavos (ARS): 2_500_000 = $ 25.000,00
import { describe, expect, it } from 'vitest';
import { daysAgo, DbError, newUser, Session, today } from './helpers';

/** Espera que la llamada falle con ese código (detail) y devuelve el error para revisar el mensaje. */
async function rejects(p: Promise<unknown>, code: string): Promise<DbError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DbError);
    expect((e as DbError).detail, (e as DbError).message).toBe(code);
    return e as DbError;
  }
  throw new Error(`Se esperaba el error "${code}", pero la operación funcionó`);
}

const ingreso = (s: Session, account: string, amount: number, date = today()) =>
  s.rpc<string>('register_movement', { p_type: 'ingreso', p_date: date, p_amount: amount, p_account_id: account });

const gasto = (
  s: Session,
  category: string,
  parts: { account_id: string; amount: number }[],
  amount = parts.reduce((t, p) => t + p.amount, 0),
  date = today(),
) =>
  s.rpc<string>('register_movement', {
    p_type: 'gasto',
    p_date: date,
    p_amount: amount,
    p_category_id: category,
    p_parts: parts,
  });

const pago = (s: Session, from: string, to: string, amount: number) =>
  s.rpc<string>('register_movement', {
    p_type: 'pago',
    p_date: today(),
    p_amount: amount,
    p_from_account_id: from,
    p_to_account_id: to,
  });

const transfer = (s: Session, from: string, to: string, amount: number) =>
  s.rpc<string>('register_movement', {
    p_type: 'transfer',
    p_date: today(),
    p_amount: amount,
    p_from_account_id: from,
    p_to_account_id: to,
  });

async function report(s: Session) {
  const month = today().slice(0, 7) + '-01';
  const [totals] = await s.query<{ income: string; expense: string }>(
    'select income, expense from public.report_month where month = $1',
    [month],
  );
  const cats = await s.query<{ name: string; total: string }>(
    `select c.name, r.total from public.report_category_month r
     join public.categories c on c.id = r.category_id where r.month = $1`,
    [month],
  );
  return {
    income: Number(totals?.income ?? 0),
    expense: Number(totals?.expense ?? 0),
    byCategory: Object.fromEntries(cats.map((c) => [c.name, Number(c.total)])),
  };
}

// ---------------------------------------------------------------------------
describe('Al crear un usuario', () => {
  it('se crea su perfil con el nombre y las 6 categorías iniciales en orden', async () => {
    const s = await newUser('Leonardo');
    const [profile] = await s.query('select name, currency, onboarding_step from public.profiles');
    expect(profile).toEqual({ name: 'Leonardo', currency: 'ARS', onboarding_step: 'intro' });

    const cats = await s.query<{ name: string; sort_order: number }>(
      'select name, sort_order from public.categories order by sort_order',
    );
    expect(cats.map((c) => c.name)).toEqual([
      'Alimentación',
      'Salud',
      'Educación',
      'Servicios',
      'Solidaridad',
      'Ocio / Recreación',
    ]);
    expect(cats.map((c) => c.sort_order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('una categoría nueva va al final', async () => {
    const s = await newUser();
    await s.query(`insert into public.categories (name) values ('  Mascotas ')`);
    const [cat] = await s.query('select name, sort_order from public.categories where name = $1', ['Mascotas']);
    expect(cat).toEqual({ name: 'Mascotas', sort_order: 6 });
  });
});

// ---------------------------------------------------------------------------
describe('Seguridad', () => {
  it('cada persona ve solo sus datos', async () => {
    const ana = await newUser('Ana');
    const beto = await newUser('Beto');
    await ana.createMoney('Banco', 100_000);

    expect(await beto.query('select * from public.accounts')).toHaveLength(0);
    expect(await beto.query('select * from public.profiles')).toHaveLength(1);
    expect(await beto.query('select * from public.categories')).toHaveLength(6);
  });

  it('no se puede cambiar un saldo directo, solo con movimientos', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 100_000);
    await expect(s.query('update public.accounts set amount = 999 where id = $1', [banco])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      s.query(`insert into public.movements (user_id, type, amount, date, account_id)
               values ($1, 'ingreso', 5, current_date, $2)`, [s.uid, banco]),
    ).rejects.toThrow(/permission denied/);
    await expect(s.query('delete from public.movements')).rejects.toThrow(/permission denied/);
  });

  it('no se pueden usar cuentas de otra persona', async () => {
    const ana = await newUser('Ana');
    const beto = await newUser('Beto');
    const bancoAna = await ana.createMoney('Banco', 100_000);
    await rejects(ingreso(beto, bancoAna, 500), 'cuenta_inexistente');
    expect(await ana.balance(bancoAna)).toBe(100_000);
  });

  it('sin sesión no se puede hacer nada', async () => {
    const s = new Session(null);
    await rejects(s.rpc('create_account', { p_name: 'Banco' }), 'sin_sesion');
  });

  it('la moneda no se puede cambiar después de la configuración inicial', async () => {
    const s = await newUser();
    await s.query(`update public.profiles set currency = 'CLP', onboarding_step = 'done'`);
    await rejects(s.query(`update public.profiles set currency = 'USD'`), 'moneda_fija');
  });
});

// ---------------------------------------------------------------------------
describe('Efecto de cada movimiento', () => {
  it('ingreso: sube la cuenta elegida y cuenta en el informe', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 100_000);
    await ingreso(s, banco, 50_000);
    expect(await s.balance(banco)).toBe(150_000);
    expect((await report(s)).income).toBe(50_000);
  });

  it('el ingreso solo puede ir a una cuenta de dinero', async () => {
    const s = await newUser();
    const visa = await s.createOwe('Visa');
    await rejects(ingreso(s, visa, 500), 'tipo_de_cuenta');
  });

  it('gasto con dinero: baja la cuenta y cuenta como gasto', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 100_000);
    const salud = await s.categoryId('Salud');
    await gasto(s, salud, [{ account_id: banco, amount: 30_000 }]);
    expect(await s.balance(banco)).toBe(70_000);
    expect((await report(s)).byCategory).toEqual({ Salud: 30_000 });
  });

  it('gasto con tarjeta: no toca el dinero, sube la tarjeta y cuenta en el mes de la compra', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 100_000);
    const visa = await s.createOwe('Visa');
    const ali = await s.categoryId('Alimentación');
    await gasto(s, ali, [{ account_id: visa, amount: 900_000 }]); // las tarjetas no tienen tope
    expect(await s.balance(banco)).toBe(100_000);
    expect(await s.balance(visa)).toBe(900_000);
    expect((await report(s)).expense).toBe(900_000);
  });

  it('transferencia: baja una cuenta, sube la otra y no cuenta en el informe', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 100_000);
    const efectivo = await s.createMoney('Efectivo');
    await transfer(s, banco, efectivo, 40_000);
    expect(await s.balance(banco)).toBe(60_000);
    expect(await s.balance(efectivo)).toBe(40_000);
    expect(await report(s)).toEqual({ income: 0, expense: 0, byCategory: {} });
  });

  it('anotar por pagar: sube lo que se debe (y 0 es válido)', async () => {
    const s = await newUser();
    const prestamo = await s.createOwe('Préstamo de Juan', 500_000, 'persona');
    expect(await s.balance(prestamo)).toBe(500_000);
    const [mov] = await s.query('select type, amount from public.movements where to_account_id = $1', [prestamo]);
    expect(mov).toEqual({ type: 'nuevo_pagar', amount: '500000' });

    const cero = await s.createOwe('Cuotas heladera', 0, 'cuotas');
    expect(await s.balance(cero)).toBe(0);
    expect(await s.query('select 1 from public.movements where to_account_id = $1', [cero])).toHaveLength(0);
  });

  it('una cuenta por pagar necesita su tipo', async () => {
    const s = await newUser();
    await rejects(s.rpc('create_account', { p_name: 'Visa', p_kind: 'pagar' }), 'falta_tipo_deuda');
  });

  it('actualizar monto por pagar: sube o baja, sin pasar de cero', async () => {
    const s = await newUser();
    const visa = await s.createOwe('Visa', 100_000);
    await s.rpc('register_movement', { p_type: 'ajuste_pagar', p_date: today(), p_delta: 5_000, p_to_account_id: visa });
    expect(await s.balance(visa)).toBe(105_000);
    await s.rpc('register_movement', { p_type: 'ajuste_pagar', p_date: today(), p_delta: -15_000, p_to_account_id: visa });
    expect(await s.balance(visa)).toBe(90_000);
    await rejects(
      s.rpc('register_movement', { p_type: 'ajuste_pagar', p_date: today(), p_delta: -90_001, p_to_account_id: visa }),
      'saldo_negativo',
    );
    expect(await report(s)).toEqual({ income: 0, expense: 0, byCategory: {} });
  });
});

// ---------------------------------------------------------------------------
describe('Casos de prueba que no pueden fallar', () => {
  it('Cine de $ 25.000: $ 10.000 en efectivo y $ 15.000 con la Visa', async () => {
    const s = await newUser();
    const efectivo = await s.createMoney('Efectivo', 3_000_000);
    const visa = await s.createOwe('Visa');
    const ocio = await s.categoryId('Ocio / Recreación');

    const id = await gasto(s, ocio, [
      { account_id: efectivo, amount: 1_000_000 },
      { account_id: visa, amount: 1_500_000 },
    ]);

    expect(await s.balance(efectivo)).toBe(2_000_000);
    expect(await s.balance(visa)).toBe(1_500_000);
    expect((await report(s)).byCategory).toEqual({ 'Ocio / Recreación': 2_500_000 });

    // Queda como un solo gasto con dos partes
    expect(await s.query('select id from public.movements where type = $1', ['gasto'])).toHaveLength(1);
    expect(await s.query('select 1 from public.movement_parts where movement_id = $1', [id])).toHaveLength(2);
  });

  it('Gasto mayor que el saldo de la cuenta elegida: no deja registrarlo sin dividir', async () => {
    const s = await newUser();
    const efectivo = await s.createMoney('Efectivo', 1_000_000);
    const banco = await s.createMoney('Banco', 5_000_000);
    const ali = await s.categoryId('Alimentación');

    const err = await rejects(gasto(s, ali, [{ account_id: efectivo, amount: 2_500_000 }]), 'saldo_negativo');
    expect(err.message).toContain('Efectivo');
    expect(err.hint).toBe(efectivo);
    expect(await s.balance(efectivo)).toBe(1_000_000);
    expect(await s.query('select 1 from public.movements where type = $1', ['gasto'])).toHaveLength(0);

    // Dividiendo, sí
    await gasto(s, ali, [
      { account_id: efectivo, amount: 1_000_000 },
      { account_id: banco, amount: 1_500_000 },
    ]);
    expect(await s.balance(efectivo)).toBe(0);
    expect(await s.balance(banco)).toBe(3_500_000);
  });

  it('Eliminar un ingreso cuyo dinero ya se gastó: lo impide y nombra la cuenta', async () => {
    const s = await newUser();
    const efectivo = await s.createMoney('Efectivo');
    const ali = await s.categoryId('Alimentación');
    const sueldo = await ingreso(s, efectivo, 1_000_000);
    await gasto(s, ali, [{ account_id: efectivo, amount: 800_000 }]);

    const err = await rejects(s.rpc('delete_movement', { p_id: sueldo }), 'saldo_negativo');
    expect(err.message).toBe(
      'No se puede eliminar: Efectivo quedaría en negativo, porque ese dinero ya se usó en otros movimientos.',
    );
    expect(await s.balance(efectivo)).toBe(200_000);
    expect(await s.query('select 1 from public.movements where id = $1', [sueldo])).toHaveLength(1);
  });

  it('Pagar el resumen de la Visa desde el banco: baja el banco y la deuda, y el gasto del mes no cambia', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 10_000_000);
    const visa = await s.createOwe('Visa');
    const ali = await s.categoryId('Alimentación');
    await gasto(s, ali, [{ account_id: visa, amount: 3_000_000 }]);
    const antes = await report(s);

    await pago(s, banco, visa, 3_000_000);

    expect(await s.balance(banco)).toBe(7_000_000);
    expect(await s.balance(visa)).toBe(0);
    expect(await report(s)).toEqual(antes);
    expect(antes.expense).toBe(3_000_000);
  });

  it('Eliminar una cuenta con dinero: el dinero llega a la elegida y el historial sigue visible', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 1_000_000);
    const ahorro = await s.createMoney('Ahorro', 500_000);
    const salud = await s.categoryId('Salud');
    await gasto(s, salud, [{ account_id: ahorro, amount: 100_000 }]);

    await rejects(s.rpc('delete_account', { p_id: ahorro }), 'falta_destino');
    await s.rpc('delete_account', { p_id: ahorro, p_dest_account_id: banco, p_date: today() });

    expect(await s.balance(banco)).toBe(1_400_000);
    const [cuenta] = await s.query<{ amount: string; deleted_at: Date | null }>(
      'select amount, deleted_at from public.accounts where id = $1',
      [ahorro],
    );
    expect(cuenta.amount).toBe('0');
    expect(cuenta.deleted_at).not.toBeNull();

    const historial = await s.query<{ type: string; description: string }>(
      `select type, description from public.movements m
       where m.from_account_id = $1 or exists (select 1 from public.movement_parts p where p.movement_id = m.id and p.account_id = $1)
       order by created_at`,
      [ahorro],
    );
    expect(historial).toEqual([
      { type: 'gasto', description: '' },
      { type: 'transfer', description: 'Cierre de Ahorro' },
    ]);
  });
});

// ---------------------------------------------------------------------------
describe('Validaciones', () => {
  it('1 · gasto: ninguna parte de dinero supera su saldo; las tarjetas no tienen tope', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 100);
    const visa = await s.createOwe('Visa');
    const ali = await s.categoryId('Alimentación');
    await rejects(
      gasto(s, ali, [
        { account_id: banco, amount: 101 },
        { account_id: visa, amount: 50 },
      ]),
      'saldo_negativo',
    );
    await gasto(s, ali, [
      { account_id: banco, amount: 100 },
      { account_id: visa, amount: 999_999_999 },
    ]);
    expect(await s.balance(banco)).toBe(0);
  });

  it('2 · pago dividido: cuentas elegidas, montos mayores a cero, sin repetir y la suma igual al total', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 10_000);
    const efectivo = await s.createMoney('Efectivo', 10_000);
    const ali = await s.categoryId('Alimentación');

    await rejects(gasto(s, ali, [], 100), 'falta_cuenta');
    await rejects(gasto(s, ali, [{ account_id: '', amount: 100 }]), 'falta_cuenta');
    await rejects(
      gasto(s, ali, [
        { account_id: banco, amount: 100 },
        { account_id: efectivo, amount: 0 },
      ]),
      'parte_invalida',
    );
    await rejects(gasto(s, ali, [{ account_id: banco, amount: 10.5 }], 10), 'parte_invalida');
    const rep = await rejects(
      gasto(s, ali, [
        { account_id: banco, amount: 100 },
        { account_id: banco, amount: 100 },
      ]),
      'cuenta_repetida',
    );
    expect(rep.message).toContain('Banco');
    await rejects(
      gasto(
        s,
        ali,
        [
          { account_id: banco, amount: 100 },
          { account_id: efectivo, amount: 100 },
        ],
        250,
      ),
      'reparto_incompleto',
    );

    expect(await s.balance(banco)).toBe(10_000);
    expect(await s.balance(efectivo)).toBe(10_000);
  });

  it('gasto: la categoría es obligatoria y tiene que ser propia', async () => {
    const s = await newUser();
    const otra = await newUser();
    const banco = await s.createMoney('Banco', 10_000);
    await rejects(gasto(s, null as unknown as string, [{ account_id: banco, amount: 100 }]), 'falta_categoria');
    await rejects(gasto(s, await otra.categoryId('Salud'), [{ account_id: banco, amount: 100 }]), 'falta_categoria');
  });

  it('3 · pago de una deuda: no supera lo que se debe ni el saldo de origen', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 50_000);
    const visa = await s.createOwe('Visa', 30_000);
    const prestamo = await s.createOwe('Préstamo', 80_000, 'cuotas');

    const masQueDeuda = await rejects(pago(s, banco, visa, 30_001), 'saldo_negativo');
    expect(masQueDeuda.message).toBe('El monto supera lo que debés en Visa.');

    const sinSaldo = await rejects(pago(s, banco, prestamo, 50_001), 'saldo_negativo');
    expect(sinSaldo.message).toBe('En Banco no alcanza el saldo. Ninguna cuenta puede quedar en negativo.');

    await rejects(pago(s, visa, banco, 1), 'tipo_de_cuenta');
    expect(await s.balance(banco)).toBe(50_000);
    expect(await s.balance(visa)).toBe(30_000);
    expect(await s.balance(prestamo)).toBe(80_000);
  });

  it('4 · transferencia: dos cuentas distintas y no más que el saldo de origen', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 1_000);
    const efectivo = await s.createMoney('Efectivo', 0);
    const visa = await s.createOwe('Visa');
    await rejects(transfer(s, banco, banco, 100), 'misma_cuenta');
    const err = await rejects(transfer(s, banco, efectivo, 1_001), 'saldo_negativo');
    expect(err.message).toContain('Banco');
    await rejects(transfer(s, banco, visa, 100), 'tipo_de_cuenta');
    await transfer(s, banco, efectivo, 1_000);
    expect(await s.balance(banco)).toBe(0);
  });

  it('montos y fechas', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco');
    await rejects(ingreso(s, banco, 0), 'monto_invalido');
    await rejects(ingreso(s, banco, -5), 'monto_invalido');
    await rejects(ingreso(s, banco, 100, daysAgo(-3)), 'fecha_futura');
    await ingreso(s, banco, 100, daysAgo(40)); // fechas pasadas, sí
    expect(await s.balance(banco)).toBe(100);
  });

  it('5 · editar: revierte el original y aplica el nuevo', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 100_000);
    const efectivo = await s.createMoney('Efectivo', 50_000);
    const ali = await s.categoryId('Alimentación');
    const salud = await s.categoryId('Salud');
    const id = await gasto(s, ali, [{ account_id: banco, amount: 30_000 }]);

    // Mismo gasto, ahora dividido y con otra categoría
    await s.rpc('update_movement', {
      p_id: id,
      p_date: daysAgo(1),
      p_amount: 40_000,
      p_description: 'Farmacia',
      p_category_id: salud,
      p_parts: [
        { account_id: banco, amount: 10_000 },
        { account_id: efectivo, amount: 30_000 },
      ],
    });
    expect(await s.balance(banco)).toBe(90_000);
    expect(await s.balance(efectivo)).toBe(20_000);
    const [m] = await s.query('select amount, description, category_id from public.movements where id = $1', [id]);
    expect(m).toEqual({ amount: '40000', description: 'Farmacia', category_id: salud });

    // Un ingreso que cambia de cuenta
    const ing = await ingreso(s, banco, 5_000);
    await s.rpc('update_movement', { p_id: ing, p_date: today(), p_amount: 7_000, p_account_id: efectivo });
    expect(await s.balance(banco)).toBe(90_000);
    expect(await s.balance(efectivo)).toBe(27_000);
  });

  it('5 · editar: si alguna cuenta queda en negativo se rechaza todo y nombra la cuenta', async () => {
    const s = await newUser();
    const efectivo = await s.createMoney('Efectivo');
    const ali = await s.categoryId('Alimentación');
    const ing = await ingreso(s, efectivo, 10_000);
    await gasto(s, ali, [{ account_id: efectivo, amount: 8_000 }]);

    const err = await rejects(
      s.rpc('update_movement', { p_id: ing, p_date: today(), p_amount: 5_000, p_account_id: efectivo }),
      'saldo_negativo',
    );
    expect(err.message).toBe('Con este cambio, Efectivo quedaría en negativo. Revisá los montos o las cuentas.');
    expect(await s.balance(efectivo)).toBe(2_000);
    const [m] = await s.query('select amount from public.movements where id = $1', [ing]);
    expect(m.amount).toBe('10000');
  });

  it('5 · solo se editan ingresos y gastos', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 1_000);
    const efectivo = await s.createMoney('Efectivo');
    const t = await transfer(s, banco, efectivo, 500);
    await rejects(s.rpc('update_movement', { p_id: t, p_date: today(), p_amount: 100 }), 'no_editable');
  });

  it('6 · eliminar: revierte el efecto', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 100_000);
    const visa = await s.createOwe('Visa');
    const ocio = await s.categoryId('Ocio / Recreación');
    const g = await gasto(s, ocio, [
      { account_id: banco, amount: 10_000 },
      { account_id: visa, amount: 15_000 },
    ]);
    await s.rpc('delete_movement', { p_id: g });
    expect(await s.balance(banco)).toBe(100_000);
    expect(await s.balance(visa)).toBe(0);
    expect(await s.query('select 1 from public.movement_parts')).toHaveLength(0);

    const p = await s.createOwe('Préstamo', 30_000, 'persona');
    const pg = await pago(s, banco, p, 30_000);
    await s.rpc('delete_movement', { p_id: pg });
    expect(await s.balance(banco)).toBe(100_000);
    expect(await s.balance(p)).toBe(30_000);
  });

  it('6 · no se puede eliminar un movimiento ajeno', async () => {
    const ana = await newUser();
    const beto = await newUser();
    const banco = await ana.createMoney('Banco');
    const id = await ingreso(ana, banco, 100);
    await rejects(beto.rpc('delete_movement', { p_id: id }), 'movimiento_inexistente');
  });

  it('7 · los movimientos que tocan una cuenta eliminada no se pueden editar ni eliminar', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 1_000);
    const vieja = await s.createMoney('Billetera vieja');
    const id = await ingreso(s, vieja, 500);
    await s.rpc('delete_account', { p_id: vieja, p_dest_account_id: banco });

    await rejects(s.rpc('delete_movement', { p_id: id }), 'cuenta_eliminada');
    await rejects(
      s.rpc('update_movement', { p_id: id, p_date: today(), p_amount: 100, p_account_id: banco }),
      'cuenta_eliminada',
    );
    // Y no se pueden usar cuentas eliminadas en movimientos nuevos
    await rejects(ingreso(s, vieja, 100), 'cuenta_eliminada');
  });
});

// ---------------------------------------------------------------------------
describe('Cuentas', () => {
  it('nombre único entre las cuentas activas (sin importar mayúsculas)', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco');
    await s.createMoney('Efectivo');
    await rejects(s.createMoney(' banco '), 'nombre_repetido');
    await rejects(s.createOwe('BANCO'), 'nombre_repetido');
    await rejects(s.rpc('rename_account', { p_id: banco, p_name: 'efectivo' }), 'nombre_repetido');
    await rejects(s.createMoney('   '), 'falta_nombre');

    await s.rpc('rename_account', { p_id: banco, p_name: 'Banco Nación' });
    await s.rpc('delete_account', { p_id: banco });
    await s.createMoney('Banco Nación'); // el nombre se libera al eliminarla
  });

  it('ajustar saldo hacia abajo registra un gasto "Ajuste de saldo" con categoría obligatoria', async () => {
    const s = await newUser();
    const efectivo = await s.createMoney('Efectivo', 10_000);
    const ali = await s.categoryId('Alimentación');
    await rejects(s.rpc('adjust_account', { p_id: efectivo, p_new_amount: 7_000 }), 'falta_categoria');

    await s.rpc('adjust_account', { p_id: efectivo, p_new_amount: 7_000, p_category_id: ali });
    expect(await s.balance(efectivo)).toBe(7_000);
    const [m] = await s.query('select type, amount, description from public.movements');
    expect(m).toEqual({ type: 'gasto', amount: '3000', description: 'Ajuste de saldo' });
    expect((await report(s)).byCategory).toEqual({ Alimentación: 3_000 });
  });

  it('ajustar saldo hacia arriba registra un ingreso; igual monto no hace nada', async () => {
    const s = await newUser();
    const efectivo = await s.createMoney('Efectivo', 10_000);
    await s.rpc('adjust_account', { p_id: efectivo, p_new_amount: 12_500, p_description: 'Me devolvieron' });
    expect(await s.balance(efectivo)).toBe(12_500);
    const [m] = await s.query('select type, amount, description from public.movements');
    expect(m).toEqual({ type: 'ingreso', amount: '2500', description: 'Me devolvieron' });

    expect(await s.rpc('adjust_account', { p_id: efectivo, p_new_amount: 12_500 })).toBeNull();
    await rejects(s.rpc('adjust_account', { p_id: efectivo, p_new_amount: -1 }), 'monto_negativo');
  });

  it('actualizar el monto de algo por pagar registra un ajuste', async () => {
    const s = await newUser();
    const visa = await s.createOwe('Visa', 10_000);
    await s.rpc('adjust_account', { p_id: visa, p_new_amount: 11_200, p_description: 'Intereses' });
    expect(await s.balance(visa)).toBe(11_200);
    const [m] = await s.query(`select delta, description from public.movements where type = 'ajuste_pagar'`);
    expect(m).toEqual({ delta: '1200', description: 'Intereses' });
  });

  it('eliminar: con saldo cero se elimina; con deuda pendiente, primero el pago', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 10_000);
    const vacia = await s.createMoney('Vacía');
    const visa = await s.createOwe('Visa', 5_000);

    await s.rpc('delete_account', { p_id: vacia });
    expect(await s.query('select 1 from public.movements where from_account_id = $1', [vacia])).toHaveLength(0);

    const err = await rejects(s.rpc('delete_account', { p_id: visa }), 'deuda_pendiente');
    expect(err.message).toContain('Visa');
    await pago(s, banco, visa, 5_000);
    await s.rpc('delete_account', { p_id: visa });
    const [v] = await s.query('select deleted_at from public.accounts where id = $1', [visa]);
    expect(v.deleted_at).not.toBeNull();
  });

  it('eliminar con dinero: se puede mover a una cuenta nueva', async () => {
    const s = await newUser();
    await s.createMoney('Banco', 0);
    const vieja = await s.createMoney('Caja de ahorro', 7_000);
    await s.rpc('delete_account', { p_id: vieja, p_new_account_name: 'Billetera virtual' });
    const [nueva] = await s.query<{ id: string; amount: string }>(
      `select id, amount from public.accounts where name = 'Billetera virtual'`,
    );
    expect(nueva.amount).toBe('7000');
  });

  it('nunca se puede eliminar la última cuenta de dinero', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 0);
    await s.createOwe('Visa');
    await rejects(s.rpc('delete_account', { p_id: banco }), 'ultima_cuenta');
  });
});

// ---------------------------------------------------------------------------
describe('Informe', () => {
  it('suma solo ingresos y gastos del mes, separado por categoría', async () => {
    const s = await newUser();
    const banco = await s.createMoney('Banco', 0);
    const visa = await s.createOwe('Visa', 10_000);
    const ali = await s.categoryId('Alimentación');
    const salud = await s.categoryId('Salud');

    await ingreso(s, banco, 100_000);
    await gasto(s, ali, [{ account_id: banco, amount: 20_000 }]);
    await gasto(s, ali, [{ account_id: visa, amount: 5_000 }]);
    await gasto(s, salud, [{ account_id: banco, amount: 1_000 }]);
    await pago(s, banco, visa, 15_000);

    expect(await report(s)).toEqual({
      income: 100_000,
      expense: 26_000,
      byCategory: { Alimentación: 25_000, Salud: 1_000 },
    });
  });
});
