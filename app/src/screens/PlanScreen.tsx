/**
 * Pantalla de plan de acción — el puente entre el resultado y la acción concreta.
 * Lee la evaluación cerrada y sus respuestas, construye el plan (gaps + guía, ordenado
 * por prioridad y agrupado por categoría) y lo muestra como una lista de acciones.
 *
 * El orden es doctrina de la Red BPA (NP1 primero); el "cómo implementarlo" y la
 * evidencia salen de la Guía BPG-VC (citada al pie de cada acción); el nivel de esfuerzo
 * es una estimación propia, rotulada como tal. construirPlan es puro: acá sólo se lee.
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { construirPlan, type Plan } from '../domain/plan';
import { useDb } from '../db';
import * as repos from '../db/repos';
import { INDICE_GUIA } from '../guia';
import { INDICE_REQUISITOS } from '../instrumento';
import type { RootStackParamList } from '../navigation';
import { color } from '../theme';
import { CategoriaEncabezado, PlanItemCard } from '../ui/components/PlanPartes';
import { fuente } from '../ui/fonts';

type Props = NativeStackScreenProps<RootStackParamList, 'Plan'>;

type Estado =
  | { tag: 'cargando' }
  | { tag: 'no-encontrada' }
  | { tag: 'error'; mensaje: string }
  | { tag: 'ok'; plan: Plan };

export function PlanScreen({ route, navigation }: Props): React.JSX.Element {
  const db = useDb();
  const insets = useSafeAreaInsets();
  const { evaluacionId, establecimientoNombre, renspa } = route.params;
  const [estado, setEstado] = useState<Estado>({ tag: 'cargando' });

  useEffect(() => {
    let vivo = true;
    void (async () => {
      // Cualquier falla (lectura de base o armado del plan) se muestra como error con
      // salida, nunca como spinner eterno: axioma "nunca fallar en silencio".
      try {
        const [ev, respuestas] = await Promise.all([
          repos.getEvaluacion(db, evaluacionId),
          repos.listarRespuestas(db, evaluacionId),
        ]);
        if (!vivo) return;
        if (ev === null) {
          setEstado({ tag: 'no-encontrada' });
          return;
        }
        const plan = construirPlan(respuestas, INDICE_REQUISITOS, INDICE_GUIA);
        if (!vivo) return;
        setEstado({ tag: 'ok', plan });
      } catch (e) {
        if (!vivo) return;
        setEstado({ tag: 'error', mensaje: e instanceof Error ? e.message : String(e) });
      }
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
  if (estado.tag === 'no-encontrada' || estado.tag === 'error') {
    return (
      <View style={styles.centro}>
        <Text style={styles.vacioTxt}>
          {estado.tag === 'no-encontrada'
            ? 'No se encontró la evaluación.'
            : 'No se pudo armar el plan de acción.'}
        </Text>
        {estado.tag === 'error' ? <Text style={styles.errorDetalle}>{estado.mensaje}</Text> : null}
        <Pressable accessibilityRole="button" style={styles.volverBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.volverBtnTxt}>← Volver al resultado</Text>
        </Pressable>
      </View>
    );
  }

  const { plan } = estado;
  const titulo = renspa ? `${establecimientoNombre} · RENSPA ${renspa}` : establecimientoNombre;

  return (
    <View style={styles.pantalla}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable accessibilityRole="button" style={styles.volver} onPress={() => navigation.goBack()}>
          <Text style={styles.volverTxt}>← Volver</Text>
        </Pressable>
        <Text style={styles.establecimiento} numberOfLines={1}>
          {titulo}
        </Text>
        <Text style={styles.categoria}>Plan de acción</Text>
        <Text style={styles.metaTxt}>
          {plan.total_gaps} {plan.total_gaps === 1 ? 'acción prioritaria' : 'acciones prioritarias'}
          {plan.np1_ni > 0 ? ` · ${plan.np1_ni} esenciales` : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.cuerpo}>
        {plan.total_gaps === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>No hay requisitos sin implementar.</Text>
            <Text style={styles.vacioSub}>
              No quedaron brechas por resolver en esta evaluación. Cuando marques requisitos como
              &quot;no implementado&quot;, van a aparecer acá ordenados por prioridad.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.intro}>
              Ordenado por prioridad: primero los esenciales (NP1), después por menor esfuerzo.
            </Text>
            {plan.categorias.map((cat) => (
              <View key={cat.codigo}>
                <CategoriaEncabezado
                  nombre={cat.nombre}
                  scorePct={cat.score_pct}
                  nAcciones={cat.items.length}
                />
                {cat.items.map((item) => (
                  <PlanItemCard key={item.gap.codigo} item={item} />
                ))}
              </View>
            ))}
            <Text style={styles.notaPie}>
              El nivel de esfuerzo es una estimación propia, no forma parte de la Guía BPG-VC oficial.
            </Text>
          </>
        )}
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
  errorDetalle: {
    fontFamily: fuente.mono,
    fontSize: 13,
    color: color.ink2,
    textAlign: 'center',
    marginTop: 8,
  },
  volverBtn: {
    marginTop: 20,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volverBtnTxt: { fontFamily: fuente.uiFuerte, fontSize: 15, color: color.accent },
  header: { backgroundColor: color.accent, paddingHorizontal: 16, paddingBottom: 14 },
  volver: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 2 },
  volverTxt: { fontFamily: fuente.uiFuerte, fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  establecimiento: { color: '#FFFFFF', fontFamily: fuente.uiFuerte, fontSize: 15 },
  categoria: { marginTop: 10, color: '#FFFFFF', fontFamily: fuente.display, fontSize: 21 },
  metaTxt: {
    fontFamily: fuente.mono,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  cuerpo: { paddingBottom: 32 },
  intro: {
    fontFamily: fuente.ui,
    fontSize: 14,
    lineHeight: 20,
    color: color.ink2,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  vacio: { padding: 24, alignItems: 'center' },
  vacioTitulo: {
    fontFamily: fuente.display,
    fontSize: 20,
    color: color.ink,
    textAlign: 'center',
  },
  vacioSub: {
    fontFamily: fuente.ui,
    fontSize: 15,
    lineHeight: 22,
    color: color.ink2,
    textAlign: 'center',
    marginTop: 10,
  },
  notaPie: {
    fontFamily: fuente.ui,
    fontSize: 12,
    lineHeight: 18,
    color: color.ink2,
    paddingHorizontal: 16,
    paddingTop: 20,
    fontStyle: 'italic',
  },
});
