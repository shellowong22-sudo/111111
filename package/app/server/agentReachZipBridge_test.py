import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import agentReachZipBridge as bridge


def capture(action, value):
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        bridge.main()
    return json.loads(output.getvalue())


class ZipBridgeTests(unittest.TestCase):
    def test_xueqiu_search_extracts_real_shape_and_blocks_bogus_links(self):
        with patch("sys.argv", ["bridge", "xueqiu-search", "茅台"]), patch(
            "agent_reach.channels.xueqiu.XueqiuChannel"
        ) as channel:
            channel.return_value.search_stock.return_value = [
                {"symbol": "SH600519", "name": "贵州茅台", "exchange": "SH"},
                {"symbol": "http://127.0.0.1", "name": "malicious", "exchange": "SH"},
            ]
            result = capture("xueqiu-search", "茅台")
        self.assertTrue(result["ok"])
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["items"][0]["url"], "https://xueqiu.com/S/SH600519")

    def test_xhs_keeps_clean_text_and_verifiable_token_url(self):
        upstream = SimpleNamespace(returncode=0, stdout="""
items:
  - id: 64c123ab45d67ef890ab1234
    xsec_token: public-note-token
    note_card:
      title: 市场观察
      desc: "<b>观察</b>&amp;趋势"
      user:
        nickname: 研究者
""")
        with patch("sys.argv", ["bridge", "xiaohongshu-search", "市场"]), patch(
            "shutil.which", return_value="C:/tools/opencli.exe"
        ), patch("subprocess.run", return_value=upstream):
            result = capture("xiaohongshu-search", "市场")
        self.assertTrue(result["ok"])
        self.assertEqual(result["items"][0]["content"], "观察 &趋势")
        self.assertIn("xsec_token=public-note-token", result["items"][0]["url"])

    def test_xhs_does_not_run_untrusted_windows_shell_shim(self):
        with patch("sys.argv", ["bridge", "xiaohongshu-search", "markets"]), patch(
            "shutil.which", return_value="C:/tools/opencli.cmd"
        ), patch.dict(os.environ, {"APPDATA": "C:/missing-opencli-entry"}), patch("subprocess.run") as run:
            result = capture("xiaohongshu-search", "markets")
        self.assertEqual(result["error"], "XHS_OPENCLI_ENTRY_NOT_FOUND")
        run.assert_not_called()

    def test_xhs_windows_npm_shim_uses_node_entry_without_shell(self):
        upstream = SimpleNamespace(returncode=0, stdout="items: []\n")
        with tempfile.TemporaryDirectory() as app_data:
            entry = Path(app_data) / "npm" / "node_modules" / "@jackwener" / "opencli" / "dist" / "src" / "main.js"
            entry.parent.mkdir(parents=True)
            entry.touch()
            with patch.dict(os.environ, {"APPDATA": app_data}), patch(
                "shutil.which", side_effect=lambda command: "C:/tools/opencli.cmd" if command == "opencli" else "D:/node.exe"
            ), patch("subprocess.run", return_value=upstream) as run:
                bridge.xiaohongshu_search("市场")
            self.assertEqual(run.call_args.args[0][:2], ["D:/node.exe", str(entry)])
            self.assertFalse(run.call_args.kwargs.get("shell", False))


if __name__ == "__main__":
    unittest.main()
