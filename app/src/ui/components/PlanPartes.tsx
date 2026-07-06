/**
 * Piezas de la pantalla de plan de acción:
 *  - NpBadge: prioridad del requisito (NP1 esencial / NP2 importante / NP3 complementario).
 *  - EsfuerzoPill: estimación EDITORIAL de esfuerzo (no doctrina de la Red BPA).
 *  - CategoriaEncabezado: título de grupo con el score de la categoría.
 *  - PlanItemCard: una acción concreta — requisito + cómo implementarlo + evidencia + cita.
 *
 * Todo presentacional y puro (sin estado ni I/O). La procedencia es visible: la cita a la
 * guía oficial va al pie de cada acción; el esfuerzo se rotula como estimación propia.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { NivelPrioridad } from '../../domain/types';
import type { PlanItem } from '../../domain/plan';
import { color } from '../../theme';
import { fuente } from '../fonts';
import { colorPorScore } from './ResultadoPartes';

const NP: Record<NivelPrioridad, { label: string; color: string; suave: string }> = {
  1: { label: 'NP1 · ESENCIAL', color: color.estado.ni, suave: color.estadoSuave.ni },
  2: { label: 'NP2 · IMPORTANTE', color: color.estado.ip, suave: color.estadoSuave.ip },
  3: { label: 'NP3 · COMPLEMENTARIO', color: color.estado.na, suave: color.estadoSuave.na },
};

export function NpBadge({ np }: { np: NivelPrioridad }): React.JSX.Element {
  const n = NP[np];
  return (
    <View style={[styles.badge, { backgroundColor: n.suave, borderColor: n.color }]}>
      <Text style={[styles.badgeTxt, { color: n.color }]}>{n.label}</Text>
    </View>
  );
}

const ESFUERZO: Record<string, string> = {
  bajo: 'Esfuerzo bajo',
  medio: 'Esfuerzo medio',
  alto: 'Esfuerzo alto',
};

export function EsfuerzoPill({
  nivel,
}: {
  nivel: 'bajo' | 'medio' | 'alto' | null;
}): React.JSX.Element {
  const texto = nivel === null ? 'Esfuerzo a estimar' : ESFUERZO[nivel];
  return (
    <View style={styles.pill}>
      <Text style={styles.pillTxt}>{texto}</Text>
    </View>
  );
}

export function CategoriaEncabezado({
  nombre,
  scorePct,
  nAcciones,
}: {
  nombre: string;
  scorePct: number | null;
  nAcciones: number;
}): React.JSX.Element {
  return (
    <View style={styles.catEnc}>
      <View style={styles.catEncTexto}>
        <Text style={styles.catNombre}>{nombre}</Text>
        <Text style={styles.catMeta}>
          {nAcciones} {nAcciones === 1 ? 'acción' : 'acciones'}
        </Text>
      </View>
      <View style={[styles.catPunto, { backgroundColor: colorPorScore(scorePct) }]} />
    </View>
  );
}

export function PlanItemCard({ item }: { item: PlanItem }): React.JSX.Element {
  const { gap, guia } = item;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <NpBadge np={gap.np} />
        <EsfuerzoPill nivel={guia?.nivel_esfuerzo ?? null} />
      </View>
      <Text style={styles.codigo}>{gap.codigo}</Text>
      <Text style={styles.requisito}>{gap.texto}</Text>

      {guia !== null && guia.como_implementar.length > 0 ? (
        <View style={styles.bloque}>
          <Text style={styles.bloqueLabel}>Cómo implementarlo</Text>
          {guia.como_implementar.map((paso, i) => (
            <View key={i} style={styles.paso}>
              <Text style={styles.pasoNum}>{i + 1}.</Text>
              <Text style={styles.pasoTxt}>{paso}</Text>
            </View>
          ))}
        </View>
      ) : guia !== null ? (
        <Text style={styles.enPreparacion}>
          Esta práctica no tiene un ítem propio en la Guía BPG-VC. Aplicá el criterio de la
          sección citada y dejá registro de lo que hagas.
        </Text>
      ) : (
        <Text style={styles.enPreparacion}>
          Guía específica en preparación. Consultá la sección de la Guía BPG-VC citada.
        </Text>
      )}

      {guia?.evidencia_sugerida != null ? (
        <View style={styles.bloque}>
          <Text style={styles.bloqueLabel}>Evidencia sugerida</Text>
          <Text style={styles.evidencia}>{guia.evidencia_sugerida}</Text>
        </View>
      ) : null}

      {guia !== null ? (
        <Text style={styles.cita}>
          Fuente: Guía BPG-VC · {guia.cita.seccion}
          {guia.cita.item != null
            ? ` · ${guia.cita.item.includes(',') ? 'ítems' : 'ítem'} ${guia.cita.item}`
            : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontFamily: fuente.uiFuerte, fontSize: 11, letterSpacing: 0.5 },
  pill: {
    backgroundColor: color.paper,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillTxt: { fontFamily: fuente.ui, fontSize: 12, color: color.ink2 },
  catEnc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 8,
    gap: 12,
  },
  catEncTexto: { flex: 1 },
  catNombre: {
    fontFamily: fuente.display,
    fontSize: 18,
    color: color.ink,
  },
  catMeta: { fontFamily: fuente.mono, fontSize: 12, color: color.ink2, marginTop: 2 },
  catPunto: { width: 12, height: 12, borderRadius: 6 },
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 6,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  codigo: {
    fontFamily: fuente.mono,
    fontSize: 12,
    color: color.ink2,
    fontVariant: ['tabular-nums'],
  },
  requisito: {
    fontFamily: fuente.uiFuerte,
    fontSize: 16,
    lineHeight: 22,
    color: color.ink,
    marginTop: 4,
  },
  bloque: { marginTop: 12 },
  bloqueLabel: {
    fontFamily: fuente.uiFuerte,
    fontSize: 12,
    color: color.ink2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  paso: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  pasoNum: {
    fontFamily: fuente.mono,
    fontSize: 14,
    color: color.accent,
    fontVariant: ['tabular-nums'],
  },
  pasoTxt: { flex: 1, fontFamily: fuente.ui, fontSize: 15, lineHeight: 21, color: color.ink },
  evidencia: { fontFamily: fuente.ui, fontSize: 15, lineHeight: 21, color: color.ink },
  enPreparacion: {
    fontFamily: fuente.ui,
    fontSize: 14,
    lineHeight: 20,
    color: color.ink2,
    marginTop: 10,
    fontStyle: 'italic',
  },
  cita: {
    fontFamily: fuente.mono,
    fontSize: 11,
    color: color.ink2,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
});
