"""Chargement de la config depuis le .env racine du monorepo.
tagging-worker n'accède pas à S3 (le texte OCR est passé directement dans le job BullMQ).
"""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_config_py_dir = Path(__file__).resolve().parent
_root_env_candidates = list(_config_py_dir.parents)
_ROOT_ENV = _root_env_candidates[2] / ".env" if len(_root_env_candidates) > 2 else None
if _ROOT_ENV is not None:
    load_dotenv(_ROOT_ENV)


@dataclass(frozen=True)
class Config:
    redis_url: str


def load_config() -> Config:
    return Config(
        redis_url=os.environ.get("REDIS_URL", "redis://localhost:6379"),
    )
