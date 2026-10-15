// Configuración inicial: se hace una sola vez y se retoma donde quedó.
// Pasos: intro → moneda → banco → efectivo → otras → cierre
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AmountField } from '../../components/AmountField';
import { Button } from '../../components/Button';
import { Card, Row } from '../../components/Card';
import { Field } from '../../components/Field';
import { CardIcon, CheckIcon, WalletIcon } from '../../components/icons';
import { Loading } from '../../components/Loading';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { Muted, Title, Txt } from '../../components/Txt';
import { useAuth, type OnboardingStep } from '../../lib/auth';
import { call, errorMessage, listAccounts, type Account } from '../../lib/data';
import { CURRENCIES, CURRENCY_CODES, formatMoney, parseAmount, toInputText, type CurrencyCode } from '../../lib/money';
import { colors, soft } from '../../theme';

type Step = Exclude<OnboardingStep, 'done'> | 'cierre';

const PROGRESS: Record<Step, number> = { intro: 0, moneda: 0, banco: 1, efectivo: 2, otras: 3, cierre: 3 };

export default function Configuracion() {
  const { profile, updateProfile } = useAuth();
  const [step, setStep] = useState<Step>((profile?.onboarding_step as Step) ?? 'intro');
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setAccounts(await listAccounts());
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch((e) => setLoadError(errorMessage(e)));
  }, []);

  if (!profile) return null;
  if (!accounts) return <Loading error={loadError} onRetry={reload} />;

  const currency = profile.currency;
  const money = accounts.filter((a) => a.kind === 'dinero' && !a.deleted_at);

  /** Avanza (o retrocede) y lo guarda, para retomar desde ahí si se cierra la app */
  const goTo = async (next: Step) => {
    setStep(next);
    if (next !== 'cierre') await updateProfile({ onboarding_step: next }).catch(() => {});
  };

  const progress = (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= PROGRESS[step] ? colors.accent : colors.border }} />
      ))}
    </View>
  );

  switch (step) {
    case 'intro':
      return <Intro name={profile.name} progress={progress} onNext={() => goTo('moneda')} />;
    case 'moneda':
      return (
        <Moneda
          progress={progress}
          current={currency}
          onBack={() => goTo('intro')}
          onNext={async (c) => {
            if (c !== currency) await updateProfile({ currency: c });
            await reload(); // si cambió la cantidad de decimales, los montos se adaptaron
            await goTo('banco');
          }}
        />
      );
    case 'banco':
    case 'efectivo': {
      const isBank = step === 'banco';
      return (
        <CuentaPrincipal
          key={step}
          progress={progress}
          currency={currency}
          isBank={isBank}
          existing={money[isBank ? 0 : 1] ?? null}
          onBack={() => goTo(isBank ? 'moneda' : 'banco')}
          onSaved={async () => {
            await reload();
            await goTo(isBank ? 'efectivo' : 'otras');
          }}
        />
      );
    }
    case 'otras':
      return (
        <Otras
          progress={progress}
          currency={currency}
          extras={money.slice(2)}
          onBack={() => goTo('efectivo')}
          onAdded={reload}
          onDone={() => goTo('cierre')}
        />
      );
    case 'cierre':
      return (
        <Cierre
          currency={currency}
          accounts={money}
          onBack={() => setStep('otras')}
          onContinue={() => updateProfile({ onboarding_step: 'done' })}
        />
      );
  }
}

function StepLabel({ children }: { children: string }) {
  return (
    <Txt weight="bold" size={12} color={colors.accent} style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
      {children}
    </Txt>
  );
}

function Message({ lines }: { lines: string[] }) {
  return (
    <Card style={{ gap: 8 }}>
      {lines.map((l) => (
        <Txt key={l} size={17} style={{ lineHeight: 26 }}>
          {l}
        </Txt>
      ))}
    </Card>
  );
}

// 1 · Bienvenida ---------------------------------------------------------------
function Intro({ name, progress, onNext }: { name: string; progress: React.ReactNode; onNext: () => void }) {
  return (
    <Screen>
      {progress}
      <StepLabel>Bienvenida</StepLabel>
      <Title>{`${name ? `Hola, ${name}. ` : ''}Armemos la foto completa de tu dinero`}</Title>
      <Card style={{ gap: 16 }}>
        <Item
          icon={<WalletIcon />}
          bg={soft.income}
          title="Lo que tenés"
          text="Banco, efectivo, billeteras virtuales y ahorros. Lo cargamos ahora, en 3 pasos cortos."
        />
        <Item
          icon={<CardIcon />}
          bg={soft.accent}
          title="Lo que tenés por pagar"
          text="Tarjetas de crédito, cuotas o préstamos. Lo anotás después, con calma, desde Inicio. Te lo recomendamos: así ves cuánto te queda libre de verdad."
        />
      </Card>
      <Button title="Empezar" onPress={onNext} />
    </Screen>
  );
}

function Item({ icon, bg, title, text }: { icon: React.ReactNode; bg: string; title: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt weight="bold">{title}</Txt>
        <Muted>{text}</Muted>
      </View>
    </View>
  );
}

// 2 · Moneda -------------------------------------------------------------------
function Moneda({
  progress,
  current,
  onBack,
  onNext,
}: {
  progress: React.ReactNode;
  current: CurrencyCode;
  onBack: () => void;
  onNext: (c: CurrencyCode) => Promise<void>;
}) {
  const [selected, setSelected] = useState<CurrencyCode>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen back={onBack}>
      {progress}
      <StepLabel>Antes de empezar</StepLabel>
      <Title>¿En qué moneda manejás tu dinero?</Title>
      <Muted>Vamos a mostrar todos los montos en esta moneda, con su formato de puntos y comas.</Muted>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Moneda">
        {CURRENCY_CODES.map((c) => {
          const on = c === selected;
          return (
            <Pressable
              key={c}
              onPress={() => setSelected(c)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 52,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: on ? colors.accent : colors.border,
                backgroundColor: on ? soft.accent : colors.surface,
              }}
            >
              <Txt weight="bold" style={{ width: 44 }}>
                {c}
              </Txt>
              <Txt style={{ flex: 1 }}>{CURRENCIES[c].name}</Txt>
              <Txt size={13} color={colors.textMuted} tabular>
                {formatMoney(10 ** CURRENCIES[c].decimals * 1234.56, c)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button
        title="Continuar"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await onNext(selected);
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}

// 3 y 4 · Banco y efectivo -------------------------------------------------------
function CuentaPrincipal({
  progress,
  currency,
  isBank,
  existing,
  onBack,
  onSaved,
}: {
  progress: React.ReactNode;
  currency: CurrencyCode;
  isBank: boolean;
  existing: Account | null;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? (isBank ? 'Banco Principal' : 'Efectivo'));
  const [amount, setAmount] = useState(existing ? toInputText(existing.amount, currency) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const v = parseAmount(amount, currency);
    if (!name.trim()) return setError('Poné un nombre a la cuenta.');
    if (v === null) return setError('Ingresá un monto. Si no tenés dinero ahí, escribí 0.');
    if (Number.isNaN(v)) return setError('El monto no es válido. Usá solo números.');
    setError(null);
    setBusy(true);
    try {
      await call('save_initial_account', { p_id: existing?.id ?? null, p_name: name, p_amount: v });
      await onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen back={onBack}>
      {progress}
      <StepLabel>{`Paso ${isBank ? 1 : 2} de 3`}</StepLabel>
      <Message
        lines={
          isBank
            ? ['Para empezar, necesitamos saber con qué dinero contás hoy.', 'Ingresá el monto disponible en tu cuenta bancaria principal.', 'Cada detalle suma.']
            : ['Ahora vamos a sumar tu dinero en efectivo.', 'Contá con calma lo que tenés en casa y cargalo aquí.']
        }
      />
      <Field label="Cuenta" value={name} onChangeText={setName} autoComplete="off" maxLength={60} />
      <AmountField currency={currency} value={amount} onChangeText={setAmount} returnKeyType="done" onSubmitEditing={save} />
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button title="Guardar y seguir" onPress={save} loading={busy} />
    </Screen>
  );
}

// 5 · Otras cuentas ---------------------------------------------------------------
function Otras({
  progress,
  currency,
  extras,
  onBack,
  onAdded,
  onDone,
}: {
  progress: React.ReactNode;
  currency: CurrencyCode;
  extras: Account[];
  onBack: () => void;
  onAdded: () => Promise<void>;
  onDone: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    const v = parseAmount(amount, currency);
    if (!name.trim()) return setError('Poné un nombre a la cuenta.');
    if (v === null || Number.isNaN(v)) return setError('Ingresá un monto válido. Puede ser 0.');
    setError(null);
    setBusy(true);
    try {
      await call('save_initial_account', { p_id: null, p_name: name, p_amount: v });
      await onAdded();
      setAdded(`Cuenta "${name.trim()}" agregada`);
      setAdding(false);
      setName('');
      setAmount('');
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  return (
    <Screen back={onBack}>
      {progress}
      <StepLabel>Paso 3 de 3</StepLabel>
      <Message
        lines={[
          extras.length
            ? '¿Tenés dinero en alguna otra cuenta, billetera virtual o ahorro?'
            : '¿Tenés dinero en otra cuenta, billetera virtual o ahorro?',
        ]}
      />
      {extras.length ? (
        <Card style={{ paddingVertical: 12 }}>
          <SectionTitle>Cuentas que agregaste</SectionTitle>
          {extras.map((a, i) => (
            <Row key={a.id} last={i === extras.length - 1}>
              <Txt style={{ flex: 1 }}>{a.name}</Txt>
              <Txt weight="semibold" tabular>
                {formatMoney(a.amount, currency)}
              </Txt>
            </Row>
          ))}
        </Card>
      ) : null}
      {added && !adding ? <Notice kind="info">{added}</Notice> : null}

      {adding ? (
        <Card style={{ gap: 16 }}>
          <Field
            label="Nombre de la cuenta"
            value={name}
            onChangeText={setName}
            placeholder="Ej.: Mercado Pago, Plazo fijo, Ahorro"
            autoFocus
            maxLength={60}
          />
          <AmountField currency={currency} value={amount} onChangeText={setAmount} onSubmitEditing={add} />
          {error ? <Notice kind="error">{error}</Notice> : null}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              title="Cancelar"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                setAdding(false);
                setError(null);
              }}
            />
            <Button title="Agregar" style={{ flex: 1 }} onPress={add} loading={busy} />
          </View>
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="No" variant="secondary" style={{ flex: 1 }} onPress={onDone} />
          <Button
            title="Sí"
            style={{ flex: 1 }}
            onPress={() => {
              setAdded(null);
              setAdding(true);
            }}
          />
        </View>
      )}
    </Screen>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Txt weight="bold" size={12} color={colors.textMuted} style={{ letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
      {children}
    </Txt>
  );
}

// 6 · Cierre -----------------------------------------------------------------------
function Cierre({
  currency,
  accounts,
  onBack,
  onContinue,
}: {
  currency: CurrencyCode;
  accounts: Account[];
  onBack: () => void;
  onContinue: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = accounts.reduce((t, a) => t + a.amount, 0);

  return (
    <Screen back={onBack}>
      <Card highlight style={{ alignItems: 'center', paddingVertical: 28, borderWidth: 0 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: 'rgba(255,255,255,0.14)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <CheckIcon />
        </View>
        <Muted>Tu dinero disponible hoy</Muted>
        <Txt weight="bold" size={36} tabular center style={{ marginTop: 6, lineHeight: 42 }}>
          {formatMoney(total, currency)}
        </Txt>
      </Card>
      <Message
        lines={[
          'Muy bien. Este es tu punto de partida.',
          'Tomar conciencia de tu dinero es el primer paso para ordenarlo y hacerlo crecer.',
        ]}
      />
      <Card style={{ paddingVertical: 12 }}>
        <SectionTitle>{accounts.length === 1 ? '1 cuenta' : `${accounts.length} cuentas`}</SectionTitle>
        {accounts.map((a, i) => (
          <Row key={a.id} last={i === accounts.length - 1}>
            <Txt style={{ flex: 1 }}>{a.name}</Txt>
            <Txt weight="semibold" tabular>
              {formatMoney(a.amount, currency)}
            </Txt>
          </Row>
        ))}
      </Card>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Button
        title="Continuar"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onContinue();
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
