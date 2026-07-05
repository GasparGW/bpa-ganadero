/**
 * Cuerpo del requisito bajo evaluación: código (monospace, como norma IRAM), nivel
 * de prioridad con su peso, sección y el texto grande (20px, la información que se
 * lee). Contrato: design/mockup_evaluacion.html, pantalla 01, <main>.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { NivelPrioridad, Requisito } from '../../domain/types';
import { color } from '../../theme';
import { fuente } from '../fonts';

const NP_LABEL: Record<NivelPrioridad, string> = {
  1: 'NP1 · ESENCIAL · 10 PTS',
  2: 'NP2 · IMPORTANTE · 5 PTS',
  3: 'NP3 · COMPLEMENTARIO · 2,5 PTS',
};

/** Color de prioridad: NP1 rojo (esencial), NP2 ámbar, NP3 piedra. */
const NP_COLOR: Record<NivelPrioridad, string> = {
  1: color.estado.ni,
  2: color.estado.ip,
  3: color.estado.na,
};

export function RequisitoView({ requisito }: { requisito: Requisito }): React.JSX.Element {
  return (
    <View style={styles.cuerpo}>
      <View style={styles.meta}>
        <Text style={styles.codigo}>{requisito.codigo}</Text>
        <Text style={[styles.np, { color: NP_COLOR[requisito.np] }]}>{NP_LABEL[requisito.np]}</Text>
      </View>
      <Text style={styles.seccion}>{requisito.seccion}</Text>
      <Text style={styles.texto}>{requisito.texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cuerpo: { paddingHorizontal: 16, paddingTop: 20 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codigo: {
    fontFamily: fuente.mono,
    fontSize: 13,
    color: color.ink2,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  np: { fontFamily: fuente.uiFuerte, fontSize: 13, letterSpacing: 0.3 },
  seccion: {
    marginTop: 16,
    fontFamily: fuente.uiFuerte,
    fontSize: 13,
    color: color.ink2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  texto: { marginTop: 8, fontFamily: fuente.ui, fontSize: 20, lineHeight: 28, color: color.ink },
});
