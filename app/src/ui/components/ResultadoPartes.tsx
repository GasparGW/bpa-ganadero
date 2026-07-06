/**
 * Piezas de la pantalla de resultado (contrato: mockup pantalla 02):
 *  - ScoreHero: el número grande + puntos aplicables + versión del instrumento.
 *  - GapBanner: titular de brechas (NP1 sin implementar) y score potencial.
 *  - CategoriaRow: una fila del desglose por categoría, coloreada por nivel.
 *  - ExpressHero / ExpressDesglose: resultado del modo express ("M de N esenciales",
 *    sin porcentaje — es una prueba rápida, no una medición del instrumento).
 */

import { StyleSheet, Text, View } from 'react-native';

import type { ResumenExpress } from '../../express';
import { color } from '../../theme';
import { fuente } from '../fonts';
import { pct, puntos } from '../formato';

/** Color del score por umbral: ≥70 verde, ≥50 ámbar, resto rojo. `null` → piedra. */
export function colorPorScore(score: number | null): string {
  if (score === null) return color.estado.na;
  if (score >= 70) return color.estado.it;
  if (score >= 50) return color.estado.ip;
  return color.estado.ni;
}

interface HeroProps {
  scorePct: number | null;
  puntosObtenidos: number;
  maximoAplicable: number;
  instrumento: string;
  version: string;
}

export function ScoreHero(p: HeroProps): React.JSX.Element {
  return (
    <View style={styles.hero}>
      <Text style={styles.num}>
        {pct(p.scorePct)}
        <Text style={styles.pctSigno}>%</Text>
      </Text>
      <Text style={styles.sub}>
        {p.scorePct === null
          ? 'SIN REQUISITOS APLICABLES'
          : `${puntos(p.puntosObtenidos)} / ${puntos(p.maximoAplicable)} PTS APLICABLES`}
        {` · ${p.instrumento} v${p.version}`}
      </Text>
    </View>
  );
}

interface BannerProps {
  np1Ni: number;
  scorePotencial: number | null;
}

export function GapBanner({ np1Ni, scorePotencial }: BannerProps): React.JSX.Element | null {
  if (np1Ni === 0) return null;
  const req = np1Ni === 1 ? 'requisito esencial (NP1) sin implementar' : 'requisitos esenciales (NP1) sin implementar';
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTxt}>
        <Text style={styles.bannerFuerte}>
          {np1Ni} {req}.
        </Text>
        {scorePotencial !== null
          ? ` Resolverlos subiría el resultado a ${pct(scorePotencial)}%.`
          : ''}
      </Text>
    </View>
  );
}

interface FilaProps {
  nombre: string;
  nRequisitos: number;
  scorePct: number | null;
}

export function CategoriaRow({ nombre, nRequisitos, scorePct }: FilaProps): React.JSX.Element {
  return (
    <View style={styles.fila}>
      <Text style={styles.nombre}>{nombre}</Text>
      <Text style={styles.frac}>{nRequisitos} req</Text>
      <Text style={[styles.score, { color: colorPorScore(scorePct) }]}>{pct(scorePct)}</Text>
    </View>
  );
}

/** Hero del modo express: "M / N" grande + "ESENCIALES IMPLEMENTADOS". Sin porcentaje. */
export function ExpressHero({ resumen }: { resumen: ResumenExpress }): React.JSX.Element {
  return (
    <View style={styles.hero}>
      <Text style={styles.num}>
        {resumen.implementados}
        <Text style={styles.pctSigno}> / {resumen.total}</Text>
      </Text>
      <Text style={styles.sub}>ESENCIALES IMPLEMENTADOS · PRUEBA RÁPIDA</Text>
    </View>
  );
}

/** Desglose del express: parciales / sin implementar / sin responder, una fila cada uno. */
export function ExpressDesglose({ resumen }: { resumen: ResumenExpress }): React.JSX.Element {
  const filas: { etiqueta: string; valor: number; color: string }[] = [
    { etiqueta: 'Implementados', valor: resumen.implementados, color: color.estado.it },
    { etiqueta: 'Parciales', valor: resumen.parciales, color: color.estado.ip },
    { etiqueta: 'Sin implementar', valor: resumen.sinImplementar, color: color.estado.ni },
    { etiqueta: 'No aplica', valor: resumen.noAplica, color: color.estado.na },
    { etiqueta: 'Sin responder', valor: resumen.sinResponder, color: color.ink2 },
  ];
  return (
    <View style={styles.lista}>
      {filas.map((f) => (
        <View key={f.etiqueta} style={styles.fila}>
          <View style={[styles.punto, { backgroundColor: f.color }]} />
          <Text style={styles.nombre}>{f.etiqueta}</Text>
          <Text style={[styles.score, { color: f.color }]}>{f.valor}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: 16 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  // fontVariant tabular-nums (design/tokens.json → numeros): cifras de ancho fijo,
  // para que el número no "salte" al cambiar de valor.
  num: {
    fontFamily: fuente.display,
    fontSize: 64,
    color: color.ink,
    lineHeight: 66,
    fontVariant: ['tabular-nums'],
  },
  pctSigno: { fontSize: 32 },
  sub: {
    fontFamily: fuente.mono,
    fontSize: 13,
    color: color.ink2,
    marginTop: 6,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  banner: {
    margin: 16,
    backgroundColor: color.estadoSuave.ni,
    borderWidth: 1,
    borderColor: color.estado.ni,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bannerTxt: { fontFamily: fuente.ui, fontSize: 15, lineHeight: 22, color: color.ink },
  bannerFuerte: { fontFamily: fuente.uiFuerte, color: color.estado.ni },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  nombre: { flex: 1, fontFamily: fuente.uiFuerte, fontSize: 16, color: color.ink },
  frac: { fontFamily: fuente.mono, fontSize: 13, color: color.ink2, fontVariant: ['tabular-nums'] },
  score: {
    fontFamily: fuente.display,
    fontSize: 19,
    width: 64,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
