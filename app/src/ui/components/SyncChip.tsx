/**
 * Chip de sync — SIEMPRE visible, nunca oculta el estado de los datos (axioma #3).
 * Honesto: muestra la cuenta real de respuestas sin subir. Colores claros porque
 * vive sobre el header accent (verde monte); son tratamiento de header, no tokens
 * semánticos de fondo claro.
 */

import { StyleSheet, Text, View } from 'react-native';

import { radios } from '../../theme';
import { fuente } from '../fonts';

const PENDIENTE = '#F2C48D'; // ámbar claro sobre accent
const OK = '#B9E4C0'; // verde claro sobre accent

export function SyncChip({ pendientes }: { pendientes: number }): React.JSX.Element {
  const sincronizado = pendientes === 0;
  const c = sincronizado ? OK : PENDIENTE;
  const texto = sincronizado ? '✓ sincronizado' : `● ${pendientes} sin sincronizar`;
  return (
    <View style={[styles.chip, { borderColor: `${c}8C` }]}>
      <Text style={[styles.texto, { color: c }]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: radios.chip,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  texto: { fontFamily: fuente.mono, fontSize: 12, fontVariant: ['tabular-nums'] },
});
