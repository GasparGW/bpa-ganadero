import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { calcularScore } from './src/domain/scoring';
import { INDICE_REQUISITOS, INSTRUMENTO_META, REQUISITOS } from './src/instrumento';

// Placeholder de Sprint 0: prueba que el instrumento canónico se carga en el
// runtime RN y que el scoring corre offline, sin I/O ni red. La pantalla de
// evaluación real (contrato design/mockup_evaluacion.html) llega en Sprint 1.
const demo = calcularScore(
  Object.fromEntries(REQUISITOS.map((r) => [r.codigo, 'IT'] as const)),
  INDICE_REQUISITOS,
);

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>BPA Ganadero</Text>
      <Text style={styles.dato}>
        Instrumento {INSTRUMENTO_META.instrumento} v{INSTRUMENTO_META.version}
      </Text>
      <Text style={styles.dato}>{INSTRUMENTO_META.total_requisitos} requisitos cargados</Text>
      <Text style={styles.dato}>
        Autodiagnóstico completo en IT: {demo.score_pct}%
      </Text>
      <Text style={styles.nota}>Fundaciones verificadas · pantalla de evaluación en Sprint 1</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFAF7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  titulo: { fontSize: 24, fontWeight: '600', color: '#173F2C', marginBottom: 8 },
  dato: { fontSize: 16, color: '#191C1A' },
  nota: { fontSize: 13, color: '#5A615C', marginTop: 16, textAlign: 'center' },
});
