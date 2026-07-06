/**
 * Diálogo modal propio — reemplaza a `Alert` de React Native.
 *
 * Por qué existe: en react-native-web el `onPress` de los botones de `Alert.alert`
 * no dispara, así que el cierre de evaluación (confirmación → cerrar → navegar) no
 * funciona en el target web. Este modal es código compartido: mismo componente en
 * nativo y web, resolución por promesa (flujo async normal, sin callbacks de puente).
 *
 * API imperativa:
 *   const { confirmar, avisar } = useDialogo();
 *   if (await confirmar({ titulo, mensaje, confirmarTexto, cancelarTexto })) { ... }
 *   await avisar({ titulo, mensaje });   // un solo botón
 *
 * Las solicitudes se encolan: si llega una con otra en pantalla, espera su turno
 * (no se pierde ninguna, no se pisan).
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { color } from '../theme';
import { fuente } from './fonts';

export interface OpcionesAviso {
  readonly titulo: string;
  readonly mensaje?: string;
  readonly aceptarTexto?: string;
}

export interface OpcionesConfirmar {
  readonly titulo: string;
  readonly mensaje?: string;
  readonly confirmarTexto?: string;
  readonly cancelarTexto?: string;
  /** Tiñe el botón primario como acción de riesgo (rojo semántico). */
  readonly destructivo?: boolean;
}

export interface Dialogo {
  /** Un solo botón. Resuelve cuando el usuario lo acepta o descarta. */
  avisar(opciones: OpcionesAviso): Promise<void>;
  /** Dos botones. Resuelve `true` si confirma, `false` si cancela o descarta. */
  confirmar(opciones: OpcionesConfirmar): Promise<boolean>;
}

/** Estado interno normalizado de un diálogo. `cancelarTexto: null` ⇒ un solo botón. */
interface EstadoDialogo {
  /** Identidad única del diálogo. `cerrar` sólo actúa si coincide con el activo:
   *  blinda contra un segundo click sincrónico (el DOM aún es el del diálogo A, pero
   *  `avanzar` ya instaló B) que si no resolvería B con un valor que nadie eligió. */
  readonly id: number;
  readonly titulo: string;
  readonly mensaje?: string;
  readonly confirmarTexto: string;
  readonly cancelarTexto: string | null;
  readonly destructivo: boolean;
}

type Resolver = (valor: boolean) => void;

const DialogoContext = createContext<Dialogo | null>(null);

export function DialogoProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [actual, setActual] = useState<EstadoDialogo | null>(null);
  const cola = useRef<{ estado: EstadoDialogo; resolver: Resolver }[]>([]);
  const resolverActivo = useRef<Resolver | null>(null);
  const idActivo = useRef<number>(-1);
  const contador = useRef(0);

  const avanzar = useCallback(() => {
    const siguiente = cola.current.shift();
    if (siguiente === undefined) {
      resolverActivo.current = null;
      idActivo.current = -1;
      setActual(null);
      return;
    }
    resolverActivo.current = siguiente.resolver;
    idActivo.current = siguiente.estado.id;
    setActual(siguiente.estado);
  }, []);

  const encolar = useCallback(
    (estado: Omit<EstadoDialogo, 'id'>): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        const id = (contador.current += 1);
        cola.current.push({ estado: { ...estado, id }, resolver: resolve });
        // Si no hay diálogo activo, mostrar de una; si hay, espera su turno.
        if (resolverActivo.current === null) avanzar();
      }),
    [avanzar],
  );

  const cerrar = useCallback(
    (valor: boolean, id: number) => {
      // Ignora clicks sobre un diálogo que ya no es el activo (doble click sincrónico).
      if (idActivo.current !== id) return;
      const resolver = resolverActivo.current;
      resolverActivo.current = null;
      resolver?.(valor);
      avanzar();
    },
    [avanzar],
  );

  const api = useMemo<Dialogo>(
    () => ({
      avisar: (o) =>
        encolar({
          titulo: o.titulo,
          mensaje: o.mensaje,
          confirmarTexto: o.aceptarTexto ?? 'Aceptar',
          cancelarTexto: null,
          destructivo: false,
        }).then(() => undefined),
      confirmar: (o) =>
        encolar({
          titulo: o.titulo,
          mensaje: o.mensaje,
          confirmarTexto: o.confirmarTexto ?? 'Aceptar',
          cancelarTexto: o.cancelarTexto ?? 'Cancelar',
          destructivo: o.destructivo ?? false,
        }),
    }),
    [encolar],
  );

  return (
    <DialogoContext.Provider value={api}>
      {children}
      <Modal
        visible={actual !== null}
        transparent
        animationType="fade"
        accessibilityViewIsModal
        onRequestClose={() => {
          if (actual !== null) cerrar(false, actual.id);
        }}
      >
        {actual !== null && (
          <View style={styles.fondo}>
            <View style={styles.tarjeta}>
              <Text accessibilityRole="header" style={styles.titulo}>
                {actual.titulo}
              </Text>
              {actual.mensaje !== undefined && (
                <Text style={styles.mensaje}>{actual.mensaje}</Text>
              )}
              <View style={styles.botones}>
                {actual.cancelarTexto !== null && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => cerrar(false, actual.id)}
                    style={[styles.boton, styles.botonSecundario]}
                  >
                    <Text style={styles.botonSecundarioTxt}>{actual.cancelarTexto}</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => cerrar(true, actual.id)}
                  style={[
                    styles.boton,
                    styles.botonPrimario,
                    actual.destructivo && styles.botonDestructivo,
                    actual.cancelarTexto === null && styles.botonUnico,
                  ]}
                >
                  <Text style={styles.botonPrimarioTxt}>{actual.confirmarTexto}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </DialogoContext.Provider>
  );
}

export function useDialogo(): Dialogo {
  const ctx = useContext(DialogoContext);
  if (ctx === null) {
    throw new Error('useDialogo debe usarse dentro de <DialogoProvider>');
  }
  return ctx;
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: color.surface,
    borderRadius: 6,
    padding: 24,
  },
  titulo: { fontFamily: fuente.uiFuerte, fontSize: 19, color: color.ink },
  mensaje: {
    fontFamily: fuente.ui,
    fontSize: 16,
    lineHeight: 23,
    color: color.ink2,
    marginTop: 10,
  },
  botones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  boton: {
    height: 52,
    minWidth: 96,
    paddingHorizontal: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonSecundario: { borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  botonSecundarioTxt: { fontFamily: fuente.uiFuerte, fontSize: 16, color: color.ink },
  botonPrimario: { backgroundColor: color.accent },
  botonDestructivo: { backgroundColor: color.estado.ni },
  botonUnico: { flex: 1 },
  botonPrimarioTxt: { fontFamily: fuente.uiFuerte, fontSize: 16, color: '#FFFFFF' },
});
