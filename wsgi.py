"""WSGI entry point for hosting (PythonAnywhere, gunicorn, waitress...)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

os.environ.setdefault("KVS_SECURE", "1")        # hosted sites run on HTTPS
os.environ.setdefault("KVS_BEHIND_PROXY", "1")  # real client IP for login throttling

from app import app as application  # noqa: E402
