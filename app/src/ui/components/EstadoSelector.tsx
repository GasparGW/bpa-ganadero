/**
 * Selector de estado — el componente CENTRAL del producto (design/DIRECCION_ARTE §2).
 * Cuatro bloques IT/IP/NI/NA en fila, ancho completo, alto ≥ 64dp (uso con guantes),
 * en la zona inferior (thumb-zone). Redundancia color + sigla (daltonismo y sol).
 * Seleccionado = relleno pleno con sigla blanca; no seleccionado = borde 2px + color.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EstadoRequisito } from '../../domain/types';
import { colorEstado, sobreColor, tacto } from '../../theme';
import { fuente } from '../fonts';

const ESTADOS: readonly { key: EstadoRequisito; desc: string }[] = [
  { key: 'IT', desc: 'TOTAL' },
  { key: 'IP', desc: 'PARCIAL' },
  { key: 'NI', desc: 'NO IMPL.' },
  { key: 'NA', desc: 'NO APLICA' },
];

interface Props {
  value: EstadoRequisito | undefined;
  onChange: (estado: EstadoRequisito) => void;
}

export function EstadoSelector({ value, onChange }: Props): React.JSX.Element {
  return (
    <View style={styles.fila}>
      {ESTADOS.map(({ key, desc }) => {
        const c = colorEstado(key);
        const sel = value === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={`${key} ${desc}`}
            onPress={() => onChange(key)}
            style={[styles.estado, { borderColor: c }, sel && { backgroundColor: c }]}
          >
            <Text style={[styles.sigla, { color: sel ? sobreColor : c }]}>{key}</Text>
            <Text style={[styles.desc, { color: sel ? sobreColor : c }]}>{desc}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 8 },
  estado: {
    flex: 1,
    height: tacto.estado, // 64dp (design/tokens.json → tacto.targetEstadoDp)
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#FFFFFF',
  },
  sigla: { fontFamily: fuente.display, fontSize: 21, letterSpacing: 0.5 },
  desc: { fontFamily: fuente.uiFuerte, fontSize: 10.5, letterSpacing: 0.2 },
});
