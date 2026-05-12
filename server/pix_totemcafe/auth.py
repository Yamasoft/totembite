import base64
import json
import os
import ssl
import time
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlencode
from urllib.request import HTTPSHandler, ProxyHandler, Request, build_opener

BASE_DIR = Path(__file__).resolve().parent
LOCAL_CONFIG = BASE_DIR / "pix_credentials.local.json"
SECRETS_DIR = Path(os.getenv("PIX_SECRETS_DIR", str(BASE_DIR / "secrets")))
DEFAULT_CERT = SECRETS_DIR / "certificado.pem"
DEFAULT_KEY = SECRETS_DIR / "chave_sem_senha.key"


def _exists(path: Optional[str]) -> bool:
    return bool(path) and Path(path).exists()


def _abspath_if_rel(path: str) -> str:
    path = (path or "").strip()
    if not path:
        return path
    if Path(path).is_absolute():
        return path
    return str((BASE_DIR / path).resolve())


def _pick_cert_key(cert_from_db: Optional[str], key_from_db: Optional[str]) -> Tuple[str, str]:
    cert_db = _abspath_if_rel(cert_from_db or "")
    key_db = _abspath_if_rel(key_from_db or "")
    if _exists(cert_db) and _exists(key_db):
        return cert_db, key_db

    cert_env = _abspath_if_rel(os.getenv("CERT_PEM", "") or "")
    key_env = _abspath_if_rel(os.getenv("KEY_PEM", "") or "")
    if _exists(cert_env) and _exists(key_env):
        return cert_env, key_env

    if DEFAULT_CERT.exists() and DEFAULT_KEY.exists():
        return str(DEFAULT_CERT), str(DEFAULT_KEY)

    raise FileNotFoundError(
        "Certificado/Chave do PIX nao encontrados.\n"
        f"Tente colocar em:\n  {DEFAULT_CERT}\n  {DEFAULT_KEY}\n"
        f"ENV tentou:\n  {cert_env or '(vazio)'}\n  {key_env or '(vazio)'}\n"
    )


def _load_local_config():
    if not LOCAL_CONFIG.exists():
        return None
    try:
        return json.loads(LOCAL_CONFIG.read_text(encoding="utf-8"))
    except Exception:
        return None


def _load_emp_ativa():
    local_cfg = _load_local_config() or {}
    local_app_key = (local_cfg.get("pix_app_key") or "").strip()
    local_cid = (local_cfg.get("pix_client_id") or "").strip()
    local_secret = (local_cfg.get("pix_client_secret") or "").strip()
    local_chave = (local_cfg.get("chave_pix") or "").strip()
    local_amb = (local_cfg.get("pix_ambiente") or "production").strip().lower()
    local_cert = (local_cfg.get("pix_cert_path") or "").strip()
    local_key = (local_cfg.get("pix_key_path") or "").strip()

    env_app_key = (os.getenv("PIX_APP_KEY") or "").strip()
    env_cid = (os.getenv("PIX_CLIENT_ID") or "").strip()
    env_secret = (os.getenv("PIX_CLIENT_SECRET") or "").strip()
    env_chave = (os.getenv("PIX_CHAVE") or "").strip()
    env_amb = (os.getenv("PIX_AMBIENTE") or "production").strip().lower()
    env_cert = (os.getenv("PIX_CERT_PATH") or "").strip()
    env_key = (os.getenv("PIX_KEY_PATH") or "").strip()

    if local_app_key and local_cid and local_secret and local_chave:
        cert_pem, key_pem = _pick_cert_key(local_cert, local_key)
        return local_app_key, local_cid, local_secret, cert_pem, key_pem, local_amb

    cert_pem, key_pem = _pick_cert_key(env_cert, env_key)
    return env_app_key, env_cid, env_secret, cert_pem, key_pem, env_amb


APP_KEY, CLIENT_ID, CLIENT_SECRET, CERT_PEM, KEY_PEM, AMBIENTE = _load_emp_ativa()
LOCAL_CFG = _load_local_config() or {}
CHAVE_PIX = (LOCAL_CFG.get("chave_pix") or os.getenv("PIX_CHAVE") or "").strip()
CERTS: Tuple[str, str] = (CERT_PEM, KEY_PEM)


_scope = "cob.read cob.write pix.read pix.write"
_token: Optional[str] = None
_expires = 0.0


def _basic_auth_header(cid: str, csecret: str) -> str:
    raw = f"{cid}:{csecret}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("utf-8")


def _ssl_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    context.load_cert_chain(certfile=CERTS[0], keyfile=CERTS[1])
    return context


def _open_direct(req: Request, timeout: int = 30):
    opener = build_opener(ProxyHandler({}), HTTPSHandler(context=_ssl_context()))
    return opener.open(req, timeout=timeout)


def get_bb_token(force: bool = False) -> str:
    global _token, _expires
    now = time.time()

    if (not force) and _token and (now < (_expires - 30)):
        return _token

    data = urlencode({"grant_type": "client_credentials", "scope": _scope}).encode("utf-8")
    headers = {
        "Authorization": _basic_auth_header(CLIENT_ID, CLIENT_SECRET),
        "Content-Type": "application/x-www-form-urlencoded",
    }
    token_url = {
        "production": "https://oauth.bb.com.br/oauth/token",
        "sandbox": "https://oauth.hm.bb.com.br/oauth/token",
    }.get(AMBIENTE, "https://oauth.bb.com.br/oauth/token")

    req = Request(token_url, data=data, headers=headers, method="POST")
    with _open_direct(req, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))

    _token = payload.get("access_token")
    expires_in = float(payload.get("expires_in", 3600))
    _expires = now + expires_in

    if not _token:
        raise RuntimeError("Falha ao obter access_token do BB: payload sem 'access_token'.")
    return _token


def get_token(force: bool = False) -> str:
    return get_bb_token(force)
