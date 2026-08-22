"""Chargement de la config depuis le .env racine du monorepo (même fichier que les services Node,
voir packages/config/src/env.ts)
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


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Variable d'environnement manquante : {name}")
    return value


@dataclass(frozen=True)
class Config:
    redis_url: str
    s3_bucket: str
    s3_endpoint: str | None
    aws_region: str
    aws_access_key_id: str
    aws_secret_access_key: str


def load_config() -> Config:
    return Config(
        redis_url=os.environ.get("REDIS_URL", "redis://localhost:6379"),
        s3_bucket=_require("S3_BUCKET"),
        s3_endpoint=os.environ.get("S3_ENDPOINT") or None,
        aws_region=os.environ.get("AWS_REGION", "garage"),
        aws_access_key_id=_require("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=_require("AWS_SECRET_ACCESS_KEY"),
    )
