import type { Category } from '../lib/data';
import { Field } from './Field';
import { Select } from './Select';

export const NEW_CATEGORY = '__nueva';

/** Elegir categoría, con la opción "+ Nueva categoría" */
export function CategoryField({
  label = 'Categoría',
  categories,
  value,
  onChange,
  newName,
  onNewName,
}: {
  label?: string;
  categories: Category[];
  value: string;
  onChange: (v: string) => void;
  newName: string;
  onNewName: (v: string) => void;
}) {
  return (
    <>
      <Select
        label={label}
        value={value}
        onChange={onChange}
        placeholder="Elegí una categoría"
        options={[
          ...categories.map((c) => ({ value: c.id, label: c.name })),
          { value: NEW_CATEGORY, label: '+ Nueva categoría', accent: true },
        ]}
      />
      {value === NEW_CATEGORY ? (
        <Field
          label="Nombre de la nueva categoría"
          value={newName}
          onChangeText={onNewName}
          placeholder="Ej.: Mascotas, Transporte"
          autoFocus
          maxLength={40}
        />
      ) : null}
    </>
  );
}

export const categoryReady = (value: string, newName: string) => !!value && (value !== NEW_CATEGORY || !!newName.trim());
