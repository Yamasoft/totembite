import base64
import io
import json
import uuid
import ssl
from typing import Optional, Dict, Any
from urllib.parse import urlencode
from urllib.error import HTTPError
from urllib.request import HTTPSHandler, ProxyHandler, Request, build_opener

try:
    import qrcode
except Exception:
    qrcode = None

from .auth import get_token, APP_KEY, CERTS, AMBIENTE

BASES = {
    "production": "https://api-pix.bb.com.br/pix/v2",
    "sandbox": "https://api.hm.bb.com.br/pix/v2",
}
BASE = BASES.get(AMBIENTE, BASES["production"])


def _ssl_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    context.load_cert_chain(certfile=CERTS[0], keyfile=CERTS[1])
    return context


def _open_direct(req: Request, timeout: int = 30):
    opener = build_opener(ProxyHandler({}), HTTPSHandler(context=_ssl_context()))
    return opener.open(req, timeout=timeout)


def _hdr() -> Dict[str, str]:
    return {"Authorization": f"Bearer {get_token()}"}


def _req(method: str, url: str, **kw) -> Dict[str, Any]:
    query = kw.pop("query", None) or {}
    headers = {**_hdr(), **(kw.pop("headers", {}) or {})}
    data = kw.pop("data", None)
    json_body = kw.pop("json", None)
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers.setdefault("Content-Type", "application/json")

    if query:
        url = f"{url}?{urlencode(query)}"

    req = Request(url, method=method, headers=headers, data=data)
    try:
        with _open_direct(req, timeout=30) as response:
            body = response.read()
            if not body:
                return {}
            return json.loads(body.decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"BB Pix HTTP {exc.code} em {method} {url}: {body}") from exc


def _mk_txid(n: int = 26) -> str:
    n = max(26, min(35, n))
    return uuid.uuid4().hex[:n]


def _qr_png_base64(payload: str):
    if not qrcode:
        return None
    image = qrcode.make(payload)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def criar_cobranca(valor: float, chave_pix: str, txid: Optional[str] = None) -> Dict[str, Any]:
    if not chave_pix:
        raise ValueError("Chave Pix ausente.")

    txid = txid or _mk_txid(26)
    body = {
        "calendario": {"expiracao": 3600},
        "valor": {"original": f"{float(valor):.2f}"},
        "chave": chave_pix,
        "solicitacaoPagador": "Pedido Direto",
    }

    cob = _req(
        "PUT",
        f"{BASE}/cob/{txid}",
        headers={"Content-Type": "application/json"},
        query={"gw-app-key": APP_KEY} if APP_KEY else None,
        json=body,
    )
    br = cob.get("pixCopiaECola") or cob.get("payload")
    if br:
        return {"txid": txid, "pixCopiaECola": br, "payload": br, "qrPngBase64": _qr_png_base64(br)}

    loc_id = (cob.get("loc") or {}).get("id")
    if not loc_id:
        cob2 = _req("GET", f"{BASE}/cob/{txid}", query={"gw-app-key": APP_KEY} if APP_KEY else None)
        loc_id = (cob2.get("loc") or {}).get("id")

    if loc_id:
        try:
            q1 = _req("GET", f"{BASE}/qrcode/{loc_id}", query={"gw-app-key": APP_KEY} if APP_KEY else None)
            br = q1.get("pixCopiaECola") or q1.get("emv") or (q1.get("qrcode") or {}).get("emv")
            if br:
                return {"txid": txid, "pixCopiaECola": br, "payload": br, "qrPngBase64": _qr_png_base64(br)}
        except Exception:
            pass

    try:
        q2 = _req("GET", f"{BASE}/cob/{txid}/qrcode", query={"gw-app-key": APP_KEY} if APP_KEY else None)
        br = q2.get("pixCopiaECola") or q2.get("emv") or (q2.get("qrcode") or {}).get("emv")
        if br:
            return {"txid": txid, "pixCopiaECola": br, "payload": br, "qrPngBase64": _qr_png_base64(br)}
    except Exception:
        pass

    return {"txid": txid, "erro": "PIX criado, mas o BR Code nao foi retornado pelo PSP."}


def status_cobranca(txid: str) -> str:
    payload = _req("GET", f"{BASE}/cob/{txid}", query={"gw-app-key": APP_KEY} if APP_KEY else None)
    return payload.get("status", "")
