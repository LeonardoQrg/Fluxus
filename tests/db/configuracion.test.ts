// Pruebas de la configuración inicial (etapa 3)
import { describe, expect, it } from 'vitest';
import { DbError, newUser, today } from './helpers';

async function code(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as DbError).detail;
  }
  return 'sin error';
}

describe('Configuración inicial', () => {
  it('crea las cuentas con su saldo inicial, sin movimientos', async () => {
    const s = await newUser();
    const banco = await s.rpc<string>('save_initial_account', { p_id: null, p_name: 'Banco Principal', p_amount: 123456 });
    const efectivo = await s.rpc<string>('save_initial_account', { p_id: null, p_name: 'Efectivo', p_amount: 0 });
    expect(await s.balance(banco)).toBe(123456);
    expect(await s.balance(efectivo)).toBe(0);
    expect(await s.query('select 1 from public.movements')).toHaveLength(0);
  });

  it('al volver atrás se corrige el nombre y el monto de la misma cuenta', async () => {
    const s = await newUser();
    const banco = await s.rpc<string>('save_initial_account', { p_id: null, p_name: 'Banco Principal', p_amount: 100 });
    const otra = await s.rpc<string>('save_initial_account', { p_id: banco, p_name: 'Banco Nación', p_amount: 500 });
    expect(otra).toBe(banco);
    const rows = await s.query('select name, amount from public.accounts');
    expect(rows).toEqual([{ name: 'Banco Nación', amount: '500' }]);
  });

  it('no repite nombres ni acepta montos negativos', async () => {
    const s = await newUser();
    await s.rpc('save_initial_account', { p_id: null, p_name: 'Efectivo', p_amount: 0 });
    expect(await code(s.rpc('save_initial_account', { p_id: null, p_name: 'efectivo', p_amount: 0 }))).toBe('nombre_repetido');
    expect(await code(s.rpc('save_initial_account', { p_id: null, p_name: 'Ahorro', p_amount: -1 }))).toBe('monto_negativo');
  });

  it('después de terminar la configuración ya no se puede usar', async () => {
    const s = await newUser();
    const banco = await s.rpc<string>('save_initial_account', { p_id: null, p_name: 'Banco', p_amount: 100 });
    await s.query(`update public.profiles set onboarding_step = 'done'`);
    expect(await code(s.rpc('save_initial_account', { p_id: banco, p_name: 'Banco', p_amount: 999 }))).toBe(
      'configuracion_terminada',
    );
    expect(await s.balance(banco)).toBe(100);
  });

  it('no corrige cuentas que ya tienen movimientos', async () => {
    const s = await newUser();
    const banco = await s.rpc<string>('save_initial_account', { p_id: null, p_name: 'Banco', p_amount: 100 });
    await s.rpc('register_movement', { p_type: 'ingreso', p_date: today(), p_amount: 50, p_account_id: banco });
    expect(await code(s.rpc('save_initial_account', { p_id: banco, p_name: 'Banco', p_amount: 0 }))).toBe(
      'cuenta_con_movimientos',
    );
  });

  it('cambiar de ARS a CLP y volver mantiene los montos cargados', async () => {
    const s = await newUser();
    const banco = await s.rpc<string>('save_initial_account', { p_id: null, p_name: 'Banco', p_amount: 150050 }); // $ 1.500,50
    await s.query(`update public.profiles set currency = 'CLP'`);
    expect(await s.balance(banco)).toBe(1501); // $1.501 (sin decimales, redondeado)
    await s.query(`update public.profiles set currency = 'USD'`);
    expect(await s.balance(banco)).toBe(150100);
    await s.query(`update public.profiles set currency = 'EUR'`);
    expect(await s.balance(banco)).toBe(150100); // misma cantidad de decimales: no cambia
  });

  it('con movimientos registrados no se puede cambiar a una moneda con otros decimales', async () => {
    const s = await newUser();
    const banco = await s.rpc<string>('save_initial_account', { p_id: null, p_name: 'Banco', p_amount: 100 });
    await s.rpc('register_movement', { p_type: 'ingreso', p_date: today(), p_amount: 50, p_account_id: banco });
    expect(await code(s.query(`update public.profiles set currency = 'CLP'`))).toBe('moneda_fija');
  });
});
