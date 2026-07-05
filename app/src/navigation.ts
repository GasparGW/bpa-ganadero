/**
 * Rutas de la app y sus parámetros (react-navigation native-stack, tipado estricto).
 * Sprint 1: Inicio → Evaluación (requisito por requisito) → Resultado (score + gaps).
 */

export type RootStackParamList = {
  Inicio: undefined;
  Evaluacion: {
    evaluacionId: string;
    establecimientoNombre: string;
    renspa: string | null;
  };
  Resultado: {
    evaluacionId: string;
    establecimientoNombre: string;
    renspa: string | null;
  };
};
