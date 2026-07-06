/**
 * Rutas de la app y sus parámetros (react-navigation native-stack, tipado estricto).
 * Sprint 1: Inicio → Evaluación (requisito por requisito) → Resultado (score + gaps).
 *
 * `modo` distingue el autodiagnóstico completo (320 requisitos) del modo express (un
 * subconjunto curado de esenciales). Viaja como parámetro hacia Evaluación (elige los
 * ítems a recorrer) y ADEMÁS se persiste en la fila `evaluacion.modo`: Resultado lo lee
 * de la base (fuente única), no del parámetro, para no depender de un dato duplicado.
 */

export type ModoEval = 'completo' | 'express';

export type RootStackParamList = {
  Inicio: undefined;
  Evaluacion: {
    evaluacionId: string;
    establecimientoNombre: string;
    renspa: string | null;
    modo: ModoEval;
  };
  Resultado: {
    evaluacionId: string;
    establecimientoNombre: string;
    renspa: string | null;
  };
  Plan: {
    evaluacionId: string;
    establecimientoNombre: string;
    renspa: string | null;
  };
};
