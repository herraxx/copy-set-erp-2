"""Shared test settings. APP_URL env var overrides the app under test (default: single/copyset-erp.html)."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.environ.get("APP_URL") or "file://" + os.path.join(ROOT, "single", "copyset-erp.html")
