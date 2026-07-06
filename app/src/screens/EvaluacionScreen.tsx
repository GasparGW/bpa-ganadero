/**
 * Pantalla de evaluación — el corazón del producto. Recorre los 320 requisitos uno
 * por uno; cada estado elegido se PERSISTE de inmediato en el SQLite local (cero
 * pérdida silenciosa) y actualiza el progreso y el chip de sync. Al finalizar, cierra
 * la evaluación (congela el score) y navega al resultado.
 *
 * Contrato visual: design/mockup_evaluacion.html, pantalla 01.
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { categoriasDe } from '../domain/categorias';
import type { EstadoRequisito, Respuestas } from '../domain/types';
import { useDb } from '../db';
import * as repos from '../db/repos';
import { TENANT_LOCAL } from '../db/tenant';
import { nuevoId } from '../db/uuid';
import { REQUISITOS_EXPRESS } from '../express';
import { INDICE_REQUISITOS, REQUISITOS } from '../instrumento';
import type { RootStackParamList } from '../navigation';
import { color } from '../theme';
import { useDialogo } from '../ui/Dialogo';
import { EncabezadoEval } from '../ui/components/EncabezadoEval';
import { EstadoSelector } from '../ui/components/EstadoSelector';
import { RequisitoView } from '../ui/components/RequisitoView';
import { fuente } from '../ui/fonts';

type Props = NativeStackScreenProps<RootStackParamList, 'Evaluacion'>;

export function EvaluacionScreen({ route, navigation }: Props): React.JSX.Element | null {
  const db = useDb();
  const { confirmar, avisar } = useDialogo();
  const { evaluacionId, establecimientoNombre, renspa, modo } = route.params;

  // Mismos requisitos e idéntico flujo; en express sólo se recorre el subset curado.
  const items = modo === 'express' ? REQUISITOS_EXPRESS : REQUISITOS;
  const total = items.length;
  const totalPorCat = useMemo(
    () => new Map(categoriasDe(items).map((c) => [c.codigo, c.nRequisitos])),
    [items],
  );

  const [idx, setIdx] = useState(0);
  const [respuestas, setRespuestas] = useState<Respuestas | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [cerrando, setCerrando] = useState(false);
  // Guard de reentrada: `cerrando` (state) recién se setea DESPUÉS de que confirma
  // resuelve, así que no cubre la ventana entre el tap y el modal. Un doble-tap en
  // "Finalizar →" dispararía dos cierres + dos navigation.replace. El ref bloquea
  // sincrónicamente desde el primer tap.
  const cerrandoRef = useRef(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [mapa, pend] = await Promise.all([
        repos.listarRespuestas(db, evaluacionId),
        repos.contarPendientes(db, evaluacionId),
      ]);
      if (vivo) {
        setRespuestas(mapa);
        setPendientes(pend);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [db, evaluacionId]);

  const requisito = items[idx];

  const catHechos = useMemo(() => {
    if (respuestas === null) return 0;
    let n = 0;
    for (const codigo of Object.keys(respuestas)) {
      if (INDICE_REQUISITOS.get(codigo)?.categoria_codigo === requisito.categoria_codigo) n += 1;
    }
    return n;
  }, [respuestas, requisito.categoria_codigo]);

  const elegir = useCallback(
    async (estado: EstadoRequisito) => {
      try {
        // Persistir PRIMERO; recién si la escritura confirmó actualizamos la UI. Si
        // setRespuesta falla, avisamos y NO marcamos el estado (cero pérdida silenciosa:
        // el usuario nunca ve como guardado algo que no se guardó).
        await repos.setRespuesta(db, {
          id: nuevoId(),
          tenantId: TENANT_LOCAL,
          evaluacionId,
          requisitoCodigo: requisito.codigo,
          estado,
          ahora: new Date().toISOString(),
        });
        setRespuestas((prev) => ({ ...(prev ?? {}), [requisito.codigo]: estado }));
        setPendientes(await repos.contarPendientes(db, evaluacionId));
      } catch (e) {
        void avisar({
          titulo: 'No se pudo guardar',
          mensaje: String(e instanceof Error ? e.message : e),
        });
      }
    },
    [db, evaluacionId, requisito.codigo, avisar],
  );

  const finalizar = useCallback(() => {
    if (cerrandoRef.current) return; // ya hay un cierre en curso (doble-tap)
    cerrandoRef.current = true;
    void (async () => {
      // Confirmación por promesa (no callback de Alert): en web el onPress de los
      // botones de Alert no dispara y este cierre quedaba muerto. Ahora es flujo async.
      const ok = await confirmar({
        titulo: 'Cerrar la evaluación',
        mensaje: 'Al cerrar la evaluación, el resultado queda fijo y no se puede editar.',
        confirmarTexto: 'Cerrar y ver resultado',
        cancelarTexto: 'Volver',
      });
      if (!ok) {
        cerrandoRef.current = false;
        return;
      }
      setCerrando(true);
      try {
        await repos.cerrarEvaluacion(db, {
          evaluacionId,
          requisitosPorCodigo: INDICE_REQUISITOS,
          ahora: new Date().toISOString(),
        });
        navigation.replace('Resultado', { evaluacionId, establecimientoNombre, renspa });
      } catch (e) {
        cerrandoRef.current = false;
        setCerrando(false);
        await avisar({
          titulo: 'No se pudo cerrar',
          mensaje: String(e instanceof Error ? e.message : e),
        });
      }
    })();
  }, [db, evaluacionId, establecimientoNombre, renspa, navigation, confirmar, avisar]);

  if (respuestas === null) return null; // gate breve mientras carga la base

  const esUltimo = idx === total - 1;
  const hechos = Object.keys(respuestas).length;

  return (
    <View style={styles.pantalla}>
      <EncabezadoEval
        establecimientoNombre={establecimientoNombre}
        renspa={renspa}
        categoriaCodigo={requisito.categoria_codigo}
        categoriaNombre={requisito.categoria}
        catHechos={catHechos}
        catTotal={totalPorCat.get(requisito.categoria_codigo) ?? 0}
        totalHechos={hechos}
        totalTotal={total}
        pendientes={pendientes}
      />

      <ScrollView style={styles.cuerpo} contentContainerStyle={styles.cuerpoContenido}>
        <RequisitoView requisito={requisito} />
      </ScrollView>

      <View style={styles.decision}>
        <View style={styles.decisionEncabezado}>
          <Text style={styles.decisionLabel}>Estado del requisito</Text>
          {/* Cierre disponible en cualquier momento: el score se calcula sobre lo
              respondido (no-NA). No obligamos a recorrer los 320 para finalizar. */}
          <Pressable accessibilityRole="button" disabled={cerrando} onPress={finalizar}>
            <Text style={styles.finalizar}>Finalizar →</Text>
          </Pressable>
        </View>
        <EstadoSelector value={respuestas[requisito.codigo]} onChange={(e) => void elegir(e)} />
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            disabled={idx === 0}
            onPress={() => setIdx((i) => Math.max(0, i - 1))}
            style={[styles.btnNav, idx === 0 && styles.btnNavOff]}
          >
            <Text style={styles.btnNavTxt}>← Anterior</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={esUltimo}
            onPress={() => setIdx((i) => Math.min(total - 1, i + 1))}
            style={[styles.btnNav, styles.btnPrimario, esUltimo && styles.btnNavOff]}
          >
            <Text style={styles.btnPrimarioTxt}>Siguiente →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.paper },
  cuerpo: { flex: 1 },
  cuerpoContenido: { paddingBottom: 20 },
  decision: {
    padding: 16,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  decisionEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  decisionLabel: {
    fontFamily: fuente.uiFuerte,
    fontSize: 13,
    color: color.ink2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  finalizar: { fontFamily: fuente.uiFuerte, fontSize: 15, color: color.accent },
  nav: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnNav: {
    flex: 1,
    height: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnNavOff: { opacity: 0.4 },
  btnNavTxt: { fontFamily: fuente.uiFuerte, fontSize: 16, color: color.ink },
  btnPrimario: { flex: 2, backgroundColor: color.accent, borderColor: color.accent },
  btnPrimarioTxt: { fontFamily: fuente.uiFuerte, fontSize: 16, color: '#FFFFFF' },
});
