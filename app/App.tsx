/**
 * Raíz de la app. Monta:
 *  - el gate de carga (fuentes + apertura del SQLite local) antes de renderizar UI,
 *  - el SQLite abierto en un contexto para toda la app,
 *  - la navegación (Inicio → Evaluación → Resultado).
 */

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { abrirBase, DbContext } from './src/db';
import type { SqlDriver } from './src/db/driver';
import type { RootStackParamList } from './src/navigation';
import { registrarServiceWorker } from './src/pwa';
import { EvaluacionScreen } from './src/screens/EvaluacionScreen';
import { InicioScreen } from './src/screens/InicioScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { ResultadoScreen } from './src/screens/ResultadoScreen';
import { color } from './src/theme';
import { DialogoProvider } from './src/ui/Dialogo';
import { fuente, useAppFonts } from './src/ui/fonts';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.JSX.Element {
  const [fuentesListas, errorFuentes] = useAppFonts();
  const [db, setDb] = useState<SqlDriver | null>(null);
  const [errorBase, setErrorBase] = useState<Error | null>(null);

  const abrir = useCallback(() => {
    setErrorBase(null);
    abrirBase().then(setDb, setErrorBase);
  }, []);

  useEffect(() => {
    abrir();
  }, [abrir]);

  // Uso offline en web (no-op en native). Una sola vez, al montar.
  useEffect(() => {
    registrarServiceWorker();
  }, []);

  // Falla de la base = puerta de entrada rota: mostramos el error con reintento en vez
  // de dejar la app colgada en el spinner (axioma: nunca fallar en silencio).
  if (errorBase !== null) {
    return (
      <View style={styles.cargando}>
        <Text style={styles.errorTitulo}>No se pudo abrir la base local</Text>
        <Text style={styles.errorDetalle}>{errorBase.message}</Text>
        <Pressable accessibilityRole="button" onPress={abrir} style={styles.reintentar}>
          <Text style={styles.reintentarTxt}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  // Si las fuentes fallan, degradamos a la del sistema (no bloqueamos): renderizamos
  // igual. Solo esperamos mientras cargan o mientras abre la base.
  const listoParaRenderizar = (fuentesListas || errorFuentes !== null) && db !== null;
  if (!listoParaRenderizar) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <DbContext.Provider value={db}>
        <DialogoProvider>
          <StatusBar style="light" />
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: color.paper },
              }}
            >
              <Stack.Screen name="Inicio" component={InicioScreen} />
              <Stack.Screen name="Evaluacion" component={EvaluacionScreen} />
              <Stack.Screen name="Resultado" component={ResultadoScreen} />
              <Stack.Screen name="Plan" component={PlanScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </DialogoProvider>
      </DbContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  cargando: {
    flex: 1,
    backgroundColor: color.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitulo: { fontFamily: fuente.uiFuerte, fontSize: 19, color: color.ink, textAlign: 'center' },
  errorDetalle: {
    fontFamily: fuente.ui,
    fontSize: 15,
    color: color.ink2,
    textAlign: 'center',
    marginTop: 8,
  },
  reintentar: {
    marginTop: 20,
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 4,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reintentarTxt: { fontFamily: fuente.uiFuerte, fontSize: 16, color: '#FFFFFF' },
});
