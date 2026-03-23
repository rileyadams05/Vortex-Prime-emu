import os
import pytest

@pytest.hookimpl(tryfirst=True)
def pytest_sessionstart(session):
    if not os.environ.get('REACT_APP_BACKEND_URL'):
        os.environ['REACT_APP_BACKEND_URL'] = "http://localhost:3001"
