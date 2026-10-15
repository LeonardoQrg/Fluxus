import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { addDays, longDate, parseISODate, today, toISODate, WEEKDAY_INITIALS, monthTitle } from '../lib/dates';
import { colors, soft } from '../theme';
import { Button } from './Button';
import { CalendarIcon, ChevronIcon } from './icons';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

/** Campo de fecha: hoy por defecto, con un calendario que no deja elegir días futuros */
export function DateField({ value, onChange, label = 'Fecha' }: { value: string; onChange: (d: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const t = today();
  const display = value === t ? `Hoy · ${longDate(value)}` : value === addDays(t, -1) ? `Ayer · ${longDate(value)}` : longDate(value);

  return (
    <View style={{ gap: 6 }}>
      <Txt weight="semibold" size={14}>
        {label}
      </Txt>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: 12,
          minHeight: 54,
          paddingHorizontal: 14,
        }}
      >
        <CalendarIcon />
        <Txt style={{ flex: 1 }}>{display[0].toUpperCase() + display.slice(1)}</Txt>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Elegí la fecha">
        <Calendar
          value={value}
          onPick={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button
            title="Ayer"
            variant="secondary"
            small
            style={{ flex: 1 }}
            onPress={() => {
              onChange(addDays(t, -1));
              setOpen(false);
            }}
          />
          <Button
            title="Hoy"
            variant="secondary"
            small
            style={{ flex: 1 }}
            onPress={() => {
              onChange(t);
              setOpen(false);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

function Calendar({ value, onPick }: { value: string; onPick: (d: string) => void }) {
  const t = today();
  const [ym, setYm] = useState(value.slice(0, 7));
  const first = parseISODate(`${ym}-01`);
  const offset = (first.getDay() + 6) % 7; // la semana empieza el lunes
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(offset).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(first.getFullYear(), first.getMonth(), d)));
  while (cells.length % 7) cells.push(null);

  const move = (delta: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + delta, 1);
    setYm(toISODate(d).slice(0, 7));
  };
  const canNext = ym < t.slice(0, 7);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => move(-1)} accessibilityRole="button" accessibilityLabel="Mes anterior" style={navBtn}>
          <ChevronIcon left />
        </Pressable>
        <Txt weight="semibold">{monthTitle(ym)}</Txt>
        <Pressable
          onPress={() => canNext && move(1)}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          style={[navBtn, { opacity: canNext ? 1 : 0.3 }]}
        >
          <ChevronIcon />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <Txt key={i} size={12} color={colors.textMuted} center style={{ flex: 1 }}>
            {d}
          </Txt>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={{ flexDirection: 'row' }}>
          {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={{ flex: 1, height: 44 }} />;
            const future = d > t;
            const on = d === value;
            return (
              <Pressable
                key={d}
                disabled={future}
                onPress={() => onPick(d)}
                accessibilityRole="button"
                accessibilityLabel={longDate(d)}
                accessibilityState={{ selected: on, disabled: future }}
                style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? colors.accent : d === t ? soft.accent : 'transparent',
                  }}
                >
                  <Txt
                    weight={on || d === t ? 'bold' : 'regular'}
                    color={on ? colors.onAccent : future ? colors.disabled : colors.text}
                    tabular
                  >
                    {Number(d.slice(8))}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const navBtn = { width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const };
