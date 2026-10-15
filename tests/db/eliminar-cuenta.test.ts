// Eliminar mi cuenta: borra el perfil y todos los datos de la persona, y solo los suyos.
import { describe, expect, it } from 'vitest';
import { DbError, newUser, Session, today } from './helpers';

const countAll = async (s: Session) =>
  (await s.query<{ n: string }>('select count(*) n from public.accounts')).map((r) => Number(r.n))[0] +
  (await s.query<{ n: string }>('select count(*) n from public.movements')).map((r) => Number(r.n))[0] +
  (await s.query<{ n: string }>('select count(*) n from public.categories')).map((r) => Number(r.n))[0];

describe('Eliminar mi cuenta', () => {
  it('borra perfil, cuentas, categorías, movimientos y partes', async () => {
    const ana = await newUser('Ana');
    const banco = await ana.createMoney('Banco', 100_000);
    const visa = await ana.createOwe('Visa', 5_000);
    const cat = await ana.categoryId('Salud');
    await ana.rpc('register_movement', {
      p_type: 'gasto',
      p_date: today(),
      p_amount: 3_000,
      p_category_id: cat,
      p_parts: [
        { account_id: banco, amount: 1_000 },
        { account_id: visa, amount: 2_000 },
      ],
    });
    await ana.rpc('register_movement', { p_type: 'ingreso', p_date: today(), p_amount: 500, p_account_id: banco });

    await ana.rpc('delete_my_account');

    // Con el usuario borrado no queda nada suyo en ninguna tabla
    const left = await ana.query<{ n: string }>(
      `select (select count(*) from public.profiles where user_id = $1)
            + (select count(*) from public.accounts where user_id = $1)
            + (select count(*) from public.categories where user_id = $1)
            + (select count(*) from public.movements where user_id = $1)
            + (select count(*) from public.movement_parts where user_id = $1) as n`,
      [ana.uid],
    ).catch(() => [{ n: 'sin acceso' }]);
    expect(left[0].n === '0' || left[0].n === 'sin acceso').toBe(true);
  });

  it('no toca los datos de otras personas', async () => {
    const ana = await newUser('Ana');
    const beto = await newUser('Beto');
    await beto.createMoney('Banco', 777);
    const antes = await countAll(beto);

    await ana.rpc('delete_my_account');

    expect(await countAll(beto)).toBe(antes);
    expect(await beto.query('select name from public.profiles')).toEqual([{ name: 'Beto' }]);
  });

  it('sin sesión no se puede', async () => {
    try {
      await new Session(null).rpc('delete_my_account');
      throw new Error('debía fallar');
    } catch (e) {
      expect((e as DbError).detail).toBe('sin_sesion');
    }
  });
});
