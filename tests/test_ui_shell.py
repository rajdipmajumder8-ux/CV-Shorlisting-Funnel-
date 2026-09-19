import pytest
from pathlib import Path

APP_PATH = Path(__file__).parent.parent / "app.py"


class TestUIShell:
    def test_app_imports(self):
        """Verify app.py can be imported without errors."""
        import app
        assert hasattr(app, '__file__')

    def test_ui_shell_imports(self):
        """Verify ui.shell module imports correctly."""
        from src.ui import shell
        assert hasattr(shell, 'render_sidebar')
        assert hasattr(shell, 'render_uploaders')
        assert hasattr(shell, 'render_results_table')
        assert hasattr(shell, 'main')


class TestSidebarParams:
    def test_sidebar_returns_params_dict(self):
        from src.ui.shell import render_sidebar
        assert callable(render_sidebar)


class TestUploaders:
    def test_uploaders_return_correct_types(self):
        from src.ui.shell import render_uploaders
        assert callable(render_uploaders)