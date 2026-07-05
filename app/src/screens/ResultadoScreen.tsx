/**
 * Pantalla de resultado — score congelado + brechas priorizadas. Lee la evaluación
 * cerrada (score ya persistido, no se recalcula al leer) y las respuestas para el
 * desglose por categoría y el análisis de gaps (NP1 sin implementar + potencial).
 *
 * Contrato visual: design/mockup_evaluacion.html, pantalla 02.
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { analizarGaps, type AnalisisGaps } from '../domain/gaps';
import { categoriasDe } from '../domain/categorias';
import { calcularScorePorCategoria } from '../domain/scoring';
import { useDb } from '../db';
import * as repos from '../db/repos';
import type { EvaluacionRow } from '../db/repos';
import { INDICE_REQUISITOS, REQUISITOS } from '../instrumento';
import type { RootStackParamList } from '../navigation';
import { color } from '../theme';
import { CategoriaRow, GapBanner, ScoreHero } from '../ui/components/ResultadoPartes';
import { SyncChip } from '../ui/components/SyncChip';
import { fuente } from '../ui/fonts';
import { fechaCorta } from '../ui/formato';

type Props = NativeStackScreenProps<RootStackParamList, 'Resultado'>;

const CATEGORIAS = categoriasDe(REQUISITOS);
const TOTAL = REQUISITOS.length;

interface Datos {
  ev: EvaluacionRow;
  gaps: AnalisisGaps;
  porCategoria: ReadonlyMap<string, number | null>;
  hechos: number;
  pendientes: number;
}

type Estado = { tag: 'cargando' } | { tag: 'no-encontrada' } | { tag: 'ok'; datos: Datos };

export function ResultadoScreen({ route }: Props): React.JSX.Element {
  const db = useDb();
  const insets = useSafeAreaInsets();
  const { evaluacionId, establecimientoNombre, renspa } = route.params;
  const [estado, setEstado] = useState<Estado>({ tag: 'cargando' });

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [ev, respuestas, pendientes] = await Promise.all([
        repos.getEvaluacion(db, evaluacionId),
        repos.listarRespuestas(db, evaluacionId),
        repos.contarPendientes(db, evaluacionId),
      ]);
      if (!vivo) return;
      if (ev === null) {
        setEstado({ tag: 'no-encontrada' });
        return;
      }
      const scores = calcularScorePorCategoria(respuestas, INDICE_REQUISITOS);
      const porCategoria = new Map<string, number | null>(
        CATEGORIAS.map((c) => [c.codigo, scores.get(c.codigo)?.score_pct ?? null]),
      );
      setEstado({
        tag: 'ok',
        datos: {
          ev,
          gaps: analizarGaps(respuestas, INDICE_REQUISITOS),
          porCategoria,
          hechos: Object.keys(respuestas).length,
          pendientes,
        },
      });
    })();
    return () => {
      vivo = false;
    };
  }, [db, evaluacionId]);

  if (estado.tag === 'cargando') {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }
  if (estado.tag === 'no-encontrada') {
    return (
      <View style={styles.centro}>
        <Text style={styles.vacioTxt}>No se encontró la evaluación.</Text>
      </View>
    );
  }
  const { ev, gaps, porCategoria, hechos, pendientes } = estado.datos;
  const titulo = renspa ? `${establecimientoNombre} · RENSPA ${renspa}` : establecimientoNombre;

  return (
    <View style={styles.pantalla}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.top}>
          <Text style={styles.establecimiento} numberOfLines={1}>
            {titulo}
          </Text>
          <SyncChip pendientes={pendientes} />
        </View>
        <Text style={styles.categoria}>Resultado del autodiagnóstico</Text>
        <View style={styles.meta}>
          <Text style={styles.metaTxt}>CERRADA {fechaCorta(ev.cerrada_en)}</Text>
          <Text style={styles.metaTxt}>
            {hechos}/{TOTAL}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.cuerpo}>
        <ScoreHero
          scorePct={ev.score_pct}
          puntosObtenidos={ev.puntos_obtenidos ?? 0}
          maximoAplicable={ev.maximo_aplicable ?? 0}
          instrumento={ev.instrumento}
          version={ev.version}
        />
        <GapBanner np1Ni={gaps.np1_ni} scorePotencial={gaps.score_potencial} />
        <View style={styles.lista}>
          {CATEGORIAS.map((c) => (
            <CategoriaRow
              key={c.codigo}
              nombre={c.nombre}
              nRequisitos={c.nRequisitos}
              scorePct={porCategoria.get(c.codigo) ?? null}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.paper },
  centro: {
    flex: 1,
    backgroundColor: color.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  vacioTxt: { fontFamily: fuente.ui, fontSize: 17, color: color.ink2, textAlign: 'center' },
  header: { backgroundColor: color.accent, paddingHorizontal: 16, paddingBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  establecimiento: { flex: 1, color: '#FFFFFF', fontFamily: fuente.uiFuerte, fontSize: 15 },
  categoria: { marginTop: 10, color: '#FFFFFF', fontFamily: fuente.display, fontSize: 21 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaTxt: {
    fontFamily: fuente.mono,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontVariant: ['tabular-nums'],
  },
  cuerpo: { paddingBottom: 32 },
  lista: { paddingHorizontal: 16 },
});
