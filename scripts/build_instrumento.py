#!/usr/bin/env python3
"""Construye el dataset canónico del instrumento BPG-VC desde app.html.

Genera:
  data/instrumento/bpg-vc_2026.07.json  — instrumento versionado con códigos estables
  data/golden_scoring.json              — casos dorados de scoring (implementación de
                                          referencia de la fórmula oficial Red BPA)

Los códigos de requisito (ej. SAN-042) son ESTABLES dentro de la versión del
instrumento: se asignan por orden de aparición dentro de cada categoría y no deben
recalcularse nunca para una versión ya publicada — versiones futuras los heredan o
agregan códigos nuevos (SCD2 en el warehouse).
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION = "2026.07"
CODIGO_INSTRUMENTO = "BPG-VC"

CODIGOS_CATEGORIA = {
    "ORGANIZACIÓN DE LA EMPRESA (AVA": ("ORG", "Organización de la Empresa"),
    "PERSONAL (AVANZADO)": ("PER", "Personal"),
    "ESTABLECIMIENTO GANADERO": ("EST", "Establecimiento Ganadero"),
    "INSTALACIONES, EQUIPOS Y HERRAM": ("INS", "Instalaciones, Equipos y Herramientas"),
    "SUELO": ("SUE", "Suelo"),
    "AGUA": ("AGU", "Agua"),
    "FORRAJES": ("FOR", "Forrajes"),
    "GESTIÓN DE ESTIÉRCOL Y EFLUENTE": ("EFL", "Gestión de Estiércol y Efluentes"),
    "GESTIÓN DE LOS RESIDUOS": ("RSD", "Gestión de los Residuos"),
    "ADAPTACIÓN Y MITIGACIÓN AL CAMB": ("CCL", "Adaptación y Mitigación al Cambio Climático"),
    "MANEJO DE RODEO": ("ROD", "Manejo de Rodeo"),
    "ALIMENTACIÓN": ("ALI", "Alimentación"),
    "SALUD ANIMAL": ("SAN", "Salud Animal"),
    "BIENESTAR ANIMAL": ("BIE", "Bienestar Animal"),
}

PESOS_NP = {1: 10.0, 2: 5.0, 3: 2.5}
MULTIPLICADORES = {"IT": 1.0, "IP": 0.5, "NI": 0.0}  # NA: excluido del denominador

# Aritmética exacta: pesos escalados ×4 (enteros 40/20/10) y multiplicadores de
# numerador en medios (IT=2, IP=1, NI=0). Así numerador y denominador se acumulan
# como enteros sin error float, y las tres capas (Python/TS/SQL) coinciden bit a bit.
PESO_X4 = {1: 40, 2: 20, 3: 10}
MULT_NUM = {"IT": 2, "IP": 1, "NI": 0}  # contribución numerador x4 = (peso_x4 // 2) * MULT_NUM


def extraer_requisitos(html_path: Path) -> list[dict]:
    html = html_path.read_text(encoding="utf-8")
    m = re.search(r"const requisitos = (\[.*?\]);", html, re.S)
    if not m:
        raise SystemExit("No se encontró el array de requisitos en app.html")
    return json.loads(m.group(1))


def construir_instrumento(raw: list[dict]) -> dict:
    contadores: dict[str, int] = {}
    requisitos = []
    for orden_global, r in enumerate(raw, start=1):
        cod_cat, nombre_cat = CODIGOS_CATEGORIA[r["hoja"]]
        contadores[cod_cat] = contadores.get(cod_cat, 0) + 1
        requisitos.append({
            "codigo": f"{cod_cat}-{contadores[cod_cat]:03d}",
            "categoria_codigo": cod_cat,
            "categoria": nombre_cat,
            "seccion": r["seccion"].strip(),
            "orden_global": orden_global,
            "orden_categoria": contadores[cod_cat],
            "texto": r["requisito"].strip(),
            "np": r["np"],
            "peso": PESOS_NP[r["np"]],
        })
    contenido_hash = hashlib.sha256(
        json.dumps([(x["codigo"], x["texto"], x["np"]) for x in requisitos],
                   ensure_ascii=False).encode()
    ).hexdigest()
    return {
        "instrumento": CODIGO_INSTRUMENTO,
        "version": VERSION,
        "nombre": "Listado de chequeo BPG-VC Producción — Comisión de Ganadería, Red BPA",
        "fuente": "Checklist Excel de la Comisión (via bpa_acordeon.html), curado 2026-07-04 "
                  "contra Guía Feedlot V2022 y Guía General BPG-VC (ver docs/curacion_checklist.md)",
        "estado": "borrador — pendiente validación final de la Comisión",
        "content_sha256": contenido_hash,
        "scoring": {
            "pesos_np": PESOS_NP,
            "multiplicadores": MULTIPLICADORES,
            "na": "excluido del denominador",
            "formula": "score = sum(peso*mult) / sum(peso | estado != NA) * 100",
        },
        "total_requisitos": len(requisitos),
        "categorias": [
            {"codigo": c, "nombre": n, "n_requisitos": contadores.get(c, 0)}
            for c, n in CODIGOS_CATEGORIA.values()
        ],
        "requisitos": requisitos,
    }


def _limpio(x: float):
    """Emite int cuando el valor es entero (2445.0 → 2445), si no float."""
    return int(x) if x == int(x) else x


def score(respuestas: dict[str, str], reqs: list[dict]) -> dict:
    """Implementación de referencia del scoring oficial (casos dorados).

    Aritmética entera exacta + redondeo MITAD HACIA ARRIBA a 2 decimales, idéntica
    a la del cliente TS (app/src/domain/scoring.ts) y la función SQL del servidor.
    NO usa round() de Python (banker's/mitad-al-par), que divergía en los empates.
    """
    por_req = {r["codigo"]: r for r in reqs}
    num_x4 = den_x4 = 0
    for codigo, estado in respuestas.items():
        if estado not in ("IT", "IP", "NI", "NA"):
            raise ValueError(f"Estado inválido para {codigo}: {estado}")
        if estado == "NA":
            continue
        px4 = PESO_X4[por_req[codigo]["np"]]
        num_x4 += (px4 // 2) * MULT_NUM[estado]
        den_x4 += px4
    if den_x4 == 0:
        pct = None
    else:
        # floor(num_x4/den_x4 * 100 * 100 + 0.5) con enteros: mitad hacia arriba
        pct = _limpio(((2 * num_x4 * 10000 + den_x4) // (2 * den_x4)) / 100)
    return {
        "puntos_obtenidos": _limpio(num_x4 / 4),
        "maximo_aplicable": _limpio(den_x4 / 4),
        "score_pct": pct,
    }


def construir_golden_cases(reqs: list[dict]) -> dict:
    todos = [r["codigo"] for r in reqs]
    np1 = [r["codigo"] for r in reqs if r["np"] == 1]
    np2 = [r["codigo"] for r in reqs if r["np"] == 2]
    np3 = [r["codigo"] for r in reqs if r["np"] == 3]
    san = [r["codigo"] for r in reqs if r["categoria_codigo"] == "SAN"]
    casos = []

    def caso(nombre, descripcion, respuestas):
        casos.append({
            "nombre": nombre,
            "descripcion": descripcion,
            "respuestas": respuestas,
            "esperado": score(respuestas, reqs),
        })

    caso("todo_IT", "Los 320 en IT → 100%", {c: "IT" for c in todos})
    caso("todo_NI", "Los 320 en NI → 0%", {c: "NI" for c in todos})
    caso("todo_IP", "Los 320 en IP → 50%", {c: "IP" for c in todos})
    caso("todo_NA", "Los 320 en NA → score indefinido (denominador 0)",
         {c: "NA" for c in todos})
    caso("na_excluye_denominador",
         "3 IT + 1 NA de pesos distintos: el NA no cuenta en el máximo",
         {np1[0]: "IT", np1[1]: "IT",
          next(r["codigo"] for r in reqs if r["np"] == 2): "IT",
          next(r["codigo"] for r in reqs if r["np"] == 3): "NA"})
    caso("mixto_categoria_san",
         "Salud Animal completa alternando IT/IP/NI cíclico",
         {c: ["IT", "IP", "NI"][i % 3] for i, c in enumerate(san)})
    caso("evaluacion_parcial",
         "Solo 10 respuestas (evaluación en progreso): el score se calcula "
         "sobre lo respondido",
         {c: ("IT" if i % 2 == 0 else "NI") for i, c in enumerate(todos[:10])})
    caso("pesos_np",
         "1 requisito de cada NP en IT + 1 de cada NP en NI → "
         "score = 17.5/35 = 50%",
         {np1[0]: "IT", np1[1]: "NI",
          np2[0]: "IT", np2[1]: "NI",
          np3[0]: "IT", np3[1]: "NI"})
    caso("empate_redondeo",
         "Empate exacto a .xx5: 1.25/40 = 3.125% → 3.13 con redondeo mitad hacia "
         "arriba (canónico, = round(numeric) de Postgres). Distingue la regla única "
         "del banker's/mitad-al-par de round() de Python (que daría 3.12). Ningún "
         "otro golden cae en un empate: este es el que falsa el contrato de 3 capas.",
         {np1[0]: "NI", np1[1]: "NI", np1[2]: "NI",
          np2[0]: "NI", np3[0]: "IP", np3[1]: "NI"})
    return {
        "descripcion": "Casos dorados de scoring — cliente y servidor deben reproducir "
                       "exactamente estos resultados. Generados por la implementación "
                       "de referencia (scripts/build_instrumento.py).",
        "instrumento": CODIGO_INSTRUMENTO,
        "version_instrumento": VERSION,
        "casos": casos,
    }


def main():
    raw = extraer_requisitos(ROOT / "app.html")
    instrumento = construir_instrumento(raw)
    out_dir = ROOT / "data" / "instrumento"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"bpg-vc_{VERSION}.json"
    out.write_text(json.dumps(instrumento, ensure_ascii=False, indent=2), encoding="utf-8")
    golden = construir_golden_cases(instrumento["requisitos"])
    (ROOT / "data" / "golden_scoring.json").write_text(
        json.dumps(golden, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{out.name}: {instrumento['total_requisitos']} requisitos, "
          f"sha256={instrumento['content_sha256'][:12]}…")
    for c in instrumento["categorias"]:
        print(f"  {c['codigo']}: {c['n_requisitos']:3d}  {c['nombre']}")
    print(f"golden_scoring.json: {len(golden['casos'])} casos")


if __name__ == "__main__":
    main()
