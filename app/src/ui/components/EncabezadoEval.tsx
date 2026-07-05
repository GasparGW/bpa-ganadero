/**
 * Header de la pantalla de evaluación: barra accent (verde monte) con el
 * establecimiento, el chip de sync, la categoría actual y el progreso (regla fina +
 * fracciones en monospace). Contrato: design/mockup_evaluacion.html, pantalla 01.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color } from '../../theme';
import { fuente } from '../fonts';
import { SyncChip } from './SyncChip';

interface Props {
  establecimientoNombre: string;
  renspa: string | null;
  categoriaCodigo: string;
  categoriaNombre: string;
  catHechos: number;
  catTotal: number;
  totalHechos: number;
  totalTotal: number;
  pendientes: number;
}

export function EncabezadoEval(props: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const frac = props.totalTotal > 0 ? props.totalHechos / props.totalTotal : 0;
  const titulo = props.renspa
    ? `${props.establecimientoNombre} · RENSPA ${props.renspa}`
    : props.establecimientoNombre;

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.top}>
        <Text style={styles.establecimiento} numberOfLines={1}>
          {titulo}
        </Text>
        <SyncChip pendientes={props.pendientes} />
      </View>
      <Text style={styles.categoria}>{props.categoriaNombre}</Text>
      <View style={styles.progress}>
        <View style={styles.rail}>
          <View style={[styles.fill, { width: `${Math.round(frac * 100)}%` }]} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaTxt}>
            {props.categoriaCodigo} {props.catHechos}/{props.catTotal}
          </Text>
          <Text style={styles.metaTxt}>
            TOTAL {props.totalHechos}/{props.totalTotal}
          </Text>
        </View>
      </View>
    </View>
  );
}

const RALE = 'rgba(255,255,255,0.85)';

const styles = StyleSheet.create({
  header: { backgroundColor: color.accent, paddingHorizontal: 16, paddingBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  establecimiento: { flex: 1, color: '#FFFFFF', fontFamily: fuente.uiFuerte, fontSize: 15 },
  categoria: { marginTop: 10, color: '#FFFFFF', fontFamily: fuente.display, fontSize: 21 },
  progress: { marginTop: 10 },
  rail: { height: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  fill: { height: 3, backgroundColor: '#FFFFFF' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  metaTxt: { fontFamily: fuente.mono, fontSize: 12, color: RALE, fontVariant: ['tabular-nums'] },
});
