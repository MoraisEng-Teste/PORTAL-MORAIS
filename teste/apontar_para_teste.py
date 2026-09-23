"""Aponta o fork de TESTE (MoraisEng-Teste/PORTAL-MORAIS) para a BRAIN TESTE e
para o Apps Script PORTAL-TESTE. SÓ roda no fork; esta pasta nunca vai para a
produção. Rodar de novo depois de cada sincronização do fork com a produção.

Uso: python teste/apontar_para_teste.py --exec https://script.google.com/macros/s/<id>/exec
"""
import argparse
import pathlib
import re
import sys

IDS = {  # produção -> BRAIN TESTE (arquivo 06 da DOCUMENTACAO)
    "3bac5ab532d380d4968df15d5357f462": "b94c5ab532d382a2840a0128217d1ea0",  # LOGINS
    "33cc5ab532d38047ae3aee8b87ac1f4d": "f53c5ab532d38325aa4a0193011aad24",  # VENDAS
    "33dc5ab532d380abaa00fecd5c2d88c2": "88ac5ab532d383e980ee015b88826d8f",  # ATIVIDADES DE VENDAS
    "33dc5ab532d38091b927d7659f98612c": "eeac5ab532d383ddaa7981cc4c215231",  # DISPONIBILIDADES
    "32fc5ab532d380a0900dd7f4bfc619bd": "a74c5ab532d38374a4170155196788f9",  # DOCUMENTOS
    "330c5ab532d38009b6c2d5d6b77b6926": "96ac5ab532d38299bd2d01aa18016caf",  # ATIVIDADES DOCS
    "358c5ab532d3804fbcbfebc3656b1220": "e50c5ab532d382a188ad81a19cfb207b",  # METAS
    "313c5ab532d3801e974ced0bb656c9d5": "007c5ab532d383ac9ec081556377772d",  # LIGAÇÕES
    "3c9c5ab532d380a0b78bdb2f421bc9f5": "5bbc5ab532d383629c3f81fd4f521891",  # PÓS OBRA
    "3c9c5ab532d3800f8261fdab1e4ff621": "3a4c5ab532d38385b893811ad439d0fb",  # ATIVIDADES PÓS OBRA
}
REPO_PROD, REPO_TESTE = "DEVMoraisEng/PORTAL-MORAIS", "MoraisEng-Teste/PORTAL-MORAIS"
EXTENSOES = {".gs", ".py", ".js", ".html", ".yml", ".yaml", ".md", ".json"}
PULAR = {".git", "venda", "teste", "dist", "img"}
PASSOS_DESLIGAR = ["Buscar dados da Análise de Dados", "Buscar dados das Obras"]
DESLIGADO = "if: ${{ false }}"


def desligar_passos(s):
    for nome in PASSOS_DESLIGAR:
        s = re.sub(r"(?m)^([ \t]*)- name: " + re.escape(nome) + r"(\r?\n)(?!\1  " + re.escape(DESLIGADO) + ")",
                   lambda m: m.group(0) + m.group(1) + "  " + DESLIGADO + m.group(2), s)
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exec", required=True, dest="url_exec")
    ap.add_argument("--raiz", default=".")
    a = ap.parse_args()
    if not re.fullmatch(r"https://script\.google\.com/macros/s/[\w-]+/exec", a.url_exec):
        sys.exit("URL do PORTAL-TESTE inválida: precisa ser https://script.google.com/macros/s/<id>/exec")
    raiz = pathlib.Path(a.raiz).resolve()
    alterados = []
    for p in sorted(raiz.rglob("*")):
        rel = p.relative_to(raiz)
        if p.is_dir() or rel.parts[0] in PULAR or p.suffix.lower() not in EXTENSOES:
            continue
        antes = p.read_bytes().decode("utf-8")
        s = antes
        for prod, teste in IDS.items():
            s = s.replace(prod, teste)
        s = s.replace(REPO_PROD, REPO_TESTE)
        if p.name == "app.js":
            s = re.sub(r'(const API\s*=\s*")[^"]*(")', lambda m: m.group(1) + a.url_exec + m.group(2), s)
            s = re.sub(r'(const API_ESCRITA\s*=\s*")[^"]*(")', lambda m: m.group(1) + a.url_exec + m.group(2), s)
        if p.name == "pages.yml":
            s = desligar_passos(s)
        if s != antes:
            p.write_bytes(s.encode("utf-8"))
            alterados.append(str(rel))
    robos = raiz / ".github" / "workflows" / "robos-mc.yml"
    if robos.exists():
        robos.unlink()
        alterados.append(".github/workflows/robos-mc.yml (apagado)")
    sobras = []
    for p in raiz.rglob("*"):
        rel = p.relative_to(raiz)
        if p.is_file() and rel.parts[0] not in PULAR and p.suffix.lower() in EXTENSOES:
            t = p.read_bytes().decode("utf-8")
            sobras += [f"{rel}: {i}" for i in IDS if i in t]
    print("alterados:", len(alterados))
    for x in alterados:
        print("  ", x)
    if sobras:
        print("ID DE PRODUÇÃO SOBROU:", *sobras, sep="\n  ")
        sys.exit(1)


if __name__ == "__main__":
    main()
