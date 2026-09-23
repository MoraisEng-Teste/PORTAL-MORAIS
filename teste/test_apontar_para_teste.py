import pathlib, subprocess, sys, tempfile, unittest

AQUI = pathlib.Path(__file__).resolve().parent
EXEC = "https://script.google.com/macros/s/AKfyTESTE123/exec"


def rodar(raiz, *extra):
    return subprocess.run([sys.executable, str(AQUI / "apontar_para_teste.py"), "--raiz", str(raiz), *extra],
                          capture_output=True, text=True)


class Apontar(unittest.TestCase):
    def montar(self, d):
        (d / "Code.gs").write_bytes(b'VENDAS: "33cc5ab532d38047ae3aee8b87ac1f4d",\r\nvar GH_REPO = "DEVMoraisEng/PORTAL-MORAIS";\r\n')
        (d / "app.js").write_text('const API   = "https://script.google.com/macros/s/PROD1/exec";\n'
                                  'const API_ESCRITA = "https://script.google.com/macros/s/PROD2/exec";\n', encoding="utf-8")
        (d / "login.html").write_text('const API = "https://script.google.com/macros/s/AKfyPROD3/exec";\n', encoding="utf-8")
        (d / "fetch_vendas.py").write_text('ID_VENDAS_PADRAO = "33cc5ab532d38047ae3aee8b87ac1f4d"\n', encoding="utf-8")
        wf = d / ".github" / "workflows"; wf.mkdir(parents=True)
        (wf / "pages.yml").write_text("    steps:\n      - name: Buscar dados das Obras\n        run: python fetch_obras.py\n", encoding="utf-8")
        (wf / "robos-mc.yml").write_text("name: Robôs\n", encoding="utf-8")
        (d / "venda").mkdir()
        (d / "venda" / "nota.md").write_text("33cc5ab532d38047ae3aee8b87ac1f4d\n", encoding="utf-8")

    def test_aponta_tudo_e_preserva_crlf(self):
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t); self.montar(d)
            r = rodar(d, "--exec", EXEC)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            code = (d / "Code.gs").read_bytes()
            self.assertIn(b"f53c5ab532d38325aa4a0193011aad24", code)
            self.assertIn(b"MoraisEng-Teste/PORTAL-MORAIS", code)
            self.assertIn(b"\r\n", code)
            app = (d / "app.js").read_text(encoding="utf-8")
            self.assertEqual(app.count(EXEC), 2)
            login = (d / "login.html").read_text(encoding="utf-8")
            self.assertIn(EXEC, login)
            self.assertNotIn("AKfyPROD3", login)
            self.assertIn("f53c5ab532d38325aa4a0193011aad24", (d / "fetch_vendas.py").read_text(encoding="utf-8"))
            pages = (d / ".github" / "workflows" / "pages.yml").read_text(encoding="utf-8")
            self.assertIn("      - name: Buscar dados das Obras\n        if: ${{ false }}\n", pages)
            self.assertFalse((d / ".github" / "workflows" / "robos-mc.yml").exists())
            self.assertIn("33cc5ab532d38047ae3aee8b87ac1f4d", (d / "venda" / "nota.md").read_text(encoding="utf-8"))

    def test_segunda_rodada_nao_duplica(self):
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t); self.montar(d)
            rodar(d, "--exec", EXEC); r = rodar(d, "--exec", EXEC)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            pages = (d / ".github" / "workflows" / "pages.yml").read_text(encoding="utf-8")
            self.assertEqual(pages.count("if: ${{ false }}"), 1)

    def test_recusa_url_que_nao_e_do_apps_script(self):
        with tempfile.TemporaryDirectory() as t:
            d = pathlib.Path(t); self.montar(d)
            r = rodar(d, "--exec", "https://exemplo.com/exec")
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("33cc5ab532d38047ae3aee8b87ac1f4d", (d / "Code.gs").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
