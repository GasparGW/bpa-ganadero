/**
 * Inicio — Sprint 1: crear un establecimiento y arrancar un autodiagnóstico. Sin
 * auth todavía (tenant local vacío); la identidad y el historial llegan en sprints
 * siguientes. Minimalista y fiel a la dirección: papel/tinta, una decisión por pantalla.
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDb } from '../db';
import * as repos from '../db/repos';
import { TENANT_LOCAL } from '../db/tenant';
import { nuevoId } from '../db/uuid';
import { INSTRUMENTO_META } from '../instrumento';
import type { RootStackParamList } from '../navigation';
import { color } from '../theme';
import { fuente } from '../ui/fonts';

type Props = NativeStackScreenProps<RootStackParamList, 'Inicio'>;

export function InicioScreen({ navigation }: Props): React.JSX.Element {
  const db = useDb();
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState('');
  const [renspa, setRenspa] = useState('');
  const [creando, setCreando] = useState(false);

  const listo = nombre.trim().length > 0 && !creando;

  const comenzar = () => {
    setCreando(true);
    void (async () => {
      try {
        const establecimientoId = nuevoId();
        const evaluacionId = nuevoId();
        const ahora = new Date().toISOString();
        const renspaLimpio = renspa.trim() || null;
        // Ambos inserts atómicos: o queda el establecimiento con su evaluación, o nada
        // (sin huérfanos). El catch avisa: crear no puede fallar en silencio.
        await repos.enTransaccion(db, async () => {
          await repos.crearEstablecimiento(db, {
            id: establecimientoId,
            tenantId: TENANT_LOCAL,
            nombre: nombre.trim(),
            renspa: renspaLimpio,
            ahora,
          });
          await repos.crearEvaluacion(db, {
            id: evaluacionId,
            tenantId: TENANT_LOCAL,
            establecimientoId,
            instrumento: INSTRUMENTO_META.instrumento,
            version: INSTRUMENTO_META.version,
            ahora,
          });
        });
        navigation.navigate('Evaluacion', {
          evaluacionId,
          establecimientoNombre: nombre.trim(),
          renspa: renspaLimpio,
        });
      } catch (e) {
        Alert.alert('No se pudo crear', String(e instanceof Error ? e.message : e));
      } finally {
        setCreando(false);
      }
    })();
  };

  return (
    <View style={[styles.pantalla, { paddingTop: insets.top + 32 }]}>
      <Text style={styles.marca}>BPA Ganadero</Text>
      <Text style={styles.bajada}>
        Autodiagnóstico de Buenas Prácticas Ganaderas. Funciona sin señal: se guarda en el
        teléfono y se sincroniza cuando haya conexión.
      </Text>

      <Text style={styles.label}>Establecimiento</Text>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        placeholder="Nombre del establecimiento"
        placeholderTextColor={color.ink2}
        style={styles.input}
      />

      <Text style={styles.label}>RENSPA (opcional)</Text>
      <TextInput
        value={renspa}
        onChangeText={setRenspa}
        placeholder="01.234.5.67890/01"
        placeholderTextColor={color.ink2}
        autoCapitalize="none"
        style={[styles.input, styles.inputMono]}
      />

      <View style={styles.rellena} />

      <Pressable
        accessibilityRole="button"
        disabled={!listo}
        onPress={comenzar}
        style={[styles.boton, !listo && styles.botonOff]}
      >
        <Text style={styles.botonTxt}>Comenzar autodiagnóstico</Text>
      </Pressable>
      <Text style={styles.nota}>
        {INSTRUMENTO_META.total_requisitos} requisitos · {INSTRUMENTO_META.instrumento} v
        {INSTRUMENTO_META.version}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.paper, paddingHorizontal: 20, paddingBottom: 24 },
  marca: { fontFamily: fuente.display, fontSize: 34, color: color.accent },
  bajada: { fontFamily: fuente.ui, fontSize: 17, lineHeight: 24, color: color.ink2, marginTop: 12 },
  label: {
    fontFamily: fuente.uiFuerte,
    fontSize: 13,
    color: color.ink2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 4,
    backgroundColor: color.surface,
    paddingHorizontal: 14,
    height: 52,
    fontFamily: fuente.ui,
    fontSize: 17,
    color: color.ink,
  },
  inputMono: { fontFamily: fuente.mono, fontSize: 15 },
  rellena: { flex: 1 },
  boton: {
    height: 56,
    borderRadius: 4,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonOff: { opacity: 0.4 },
  botonTxt: { fontFamily: fuente.uiFuerte, fontSize: 17, color: '#FFFFFF' },
  nota: { fontFamily: fuente.mono, fontSize: 12, color: color.ink2, textAlign: 'center', marginTop: 12 },
});
