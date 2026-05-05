import base64
import hashlib
import hmac
import io
import json
import mimetypes
import os
import secrets
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
DIST_DIR = ROOT_DIR / "dist"
LEGACY_JSON_PATH = DATA_DIR / "totem-bite-store.json"
SQLITE_DIR = Path(os.getenv("TOTEM_BITE_DB_DIR", r"C:\Users\Roberto\.codex\memories\totem-bite"))
SQLITE_PATH = SQLITE_DIR / "totem-bite.db"
SERVER_PORT = int(os.getenv("TOTEM_BITE_PORT", "3001"))
AUTH_SECRET = os.getenv("ADMIN_AUTH_SECRET", "totem-bite-local-secret")
DEFAULT_ADMIN_USER = os.getenv("ADMIN_USER", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "SenhaTemp123!")
TOTEMCAFE_SITE_PACKAGES = Path(r"C:\TotemCafe\.venv\Lib\site-packages")
if TOTEMCAFE_SITE_PACKAGES.exists() and str(TOTEMCAFE_SITE_PACKAGES) not in sys.path:
    sys.path.append(str(TOTEMCAFE_SITE_PACKAGES))

try:
    import qrcode
except Exception:
    qrcode = None

CATEGORIES = [
    {"id": "lanches", "label": "Lanches"},
    {"id": "bebidas", "label": "Bebidas"},
    {"id": "doces", "label": "Doces"},
]

INITIAL_PROMOTIONS = [
    {
        "id": "promo-1",
        "tag": "Hora do almoco",
        "title": "Smash + batata por preco fechado",
        "description": "Oferta valida ate 15h para pedidos feitos no app.",
        "highlight": "R$ 29,90",
    },
    {
        "id": "promo-2",
        "tag": "Delivery",
        "title": "Frete reduzido no raio de 5 km",
        "description": "Entrega com valor promocional para pedidos acima de R$ 35.",
        "highlight": "a partir de R$ 4,99",
    },
    {
        "id": "promo-3",
        "tag": "Sobremesa",
        "title": "Brownie em dobro no combo da noite",
        "description": "Leve 2 unidades ao adicionar qualquer combo premium.",
        "highlight": "2 por R$ 16,00",
    },
]

INITIAL_PRODUCTS = [
    {
        "id": "burger-brasa",
        "name": "Brasa Smash Bacon",
        "description": "Pao selado, burger de 120g, cheddar cremoso, bacon crocante e maionese da casa.",
        "category": "lanches",
        "categoryLabel": "Lanche",
        "price": 28.9,
        "stock": 18,
        "promo": True,
        "combo": False,
        "image": "/images/burger-brasa.png",
    },
    {
        "id": "combo-duplo",
        "name": "Combo Brasa Dupla",
        "description": "Dois smash burgers, frita rustica grande e dois refrigerantes de 350 ml.",
        "category": "lanches",
        "categoryLabel": "Combo",
        "price": 54.9,
        "stock": 7,
        "promo": True,
        "combo": True,
        "image": "/images/combo-brasa.png",
    },
    {
        "id": "frango-crispy",
        "name": "Chicken Crisp",
        "description": "File de frango empanado, alface fresca, picles agridoce e molho especial.",
        "category": "lanches",
        "categoryLabel": "Lanche",
        "price": 26.5,
        "stock": 10,
        "promo": False,
        "combo": False,
        "image": "/images/chicken-crisp.png",
    },
    {
        "id": "soda-citrica",
        "name": "Soda Citrica Artesanal",
        "description": "Bebida gaseificada de limao siciliano com hortela e gelo triturado.",
        "category": "bebidas",
        "categoryLabel": "Bebida",
        "price": 12.9,
        "stock": 20,
        "promo": False,
        "combo": False,
        "image": "/images/soda-citrica.png",
    },
    {
        "id": "milkshake-cacau",
        "name": "Milkshake Cacau Black",
        "description": "Sorvete cremoso batido com calda intensa de chocolate e chantilly.",
        "category": "bebidas",
        "categoryLabel": "Bebida",
        "price": 18.9,
        "stock": 9,
        "promo": True,
        "combo": False,
        "image": "/images/milkshake-cacau.png",
    },
    {
        "id": "brownie-duplo",
        "name": "Brownie Recheado Duo",
        "description": "Brownie umido com ganache, doce de leite e toque de flor de sal.",
        "category": "doces",
        "categoryLabel": "Doce",
        "price": 14.9,
        "stock": 14,
        "promo": True,
        "combo": False,
        "image": "/images/brownie-duplo.png",
    },
    {
        "id": "cookie-box",
        "name": "Cookie Box Caramelo",
        "description": "Cookie gigante com gotas de chocolate e recheio de caramelo amanteigado.",
        "category": "doces",
        "categoryLabel": "Doce",
        "price": 16.5,
        "stock": 0,
        "promo": False,
        "combo": False,
        "image": "/images/cookie-box.png",
    },
]

PAYMENT_METHODS = [
    {"id": "pix", "label": "Pix", "description": "Aprovacao imediata por QR Code"},
    {"id": "card", "label": "Cartao", "description": "Credito ou debito na entrega"},
    {"id": "cash", "label": "Dinheiro", "description": "Pagamento em maos na entrega ou retirada"},
]

ORDER_STATUSES = {
    "received": "Recebido pela cozinha",
    "preparing": "Em preparo",
    "ready": "Pronto para retirada",
    "finished": "Retirado / Finalizado",
}


def now_iso():
    return datetime.utcnow().isoformat()


def hash_password(password: str) -> str:
    return hmac.new(AUTH_SECRET.encode(), password.encode(), hashlib.sha256).hexdigest()


def sign_token(subject: str, token_type: str = "admin") -> str:
    payload = f"{token_type}.{subject}.{int(datetime.utcnow().timestamp() * 1000)}.{secrets.token_hex(12)}"
    signature = hmac.new(AUTH_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def decode_token(token: str):
    if not token:
        return None
    parts = token.split(".")
    if len(parts) < 5:
        return None
    signature = parts.pop()
    payload = ".".join(parts)
    expected = hmac.new(AUTH_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    return {
        "type": parts[0],
        "subject": parts[1],
    }


def verify_token(token: str) -> bool:
    return decode_token(token) is not None


def db_connection():
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def apply_migrations():
    SQLITE_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with db_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS migrations (
              id TEXT PRIMARY KEY,
              applied_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admin_users (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS customer_users (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              phone TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              reset_code TEXT,
              reset_requested_at TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS customer_email_verifications (
              email TEXT PRIMARY KEY,
              code TEXT NOT NULL,
              requested_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT NOT NULL,
              category TEXT NOT NULL,
              category_label TEXT NOT NULL,
              price REAL NOT NULL,
              stock INTEGER NOT NULL,
              promo INTEGER NOT NULL DEFAULT 0,
              combo INTEGER NOT NULL DEFAULT 0,
              image TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS promotions (
              id TEXT PRIMARY KEY,
              tag TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT NOT NULL,
              highlight TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              customer_id TEXT,
              customer_email TEXT,
              mode TEXT NOT NULL,
              customer_name TEXT NOT NULL,
              phone TEXT NOT NULL,
              address TEXT NOT NULL,
              subtotal REAL NOT NULL,
              delivery_fee REAL NOT NULL,
              total REAL NOT NULL,
              status TEXT NOT NULL,
              payment_method TEXT NOT NULL DEFAULT 'pix',
              payment_status TEXT NOT NULL DEFAULT 'pending',
              pix_txid TEXT,
              pix_payload TEXT,
              status_token TEXT,
              status_updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS order_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              order_id TEXT NOT NULL,
              product_id TEXT NOT NULL,
              name TEXT NOT NULL,
              price REAL NOT NULL,
              quantity INTEGER NOT NULL,
              FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
            );
            """
        )

        migration_exists = conn.execute("SELECT 1 FROM migrations WHERE id = ?", ("001_init_python",)).fetchone()
        if not migration_exists:
            conn.execute("INSERT INTO migrations (id, applied_at) VALUES (?, ?)", ("001_init_python", now_iso()))

        order_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(orders)").fetchall()
        }
        customer_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(customer_users)").fetchall()
        }
        if "payment_method" not in order_columns:
            conn.execute("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'pix'")
        if "payment_status" not in order_columns:
            conn.execute("ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'")
        if "customer_id" not in order_columns:
            conn.execute("ALTER TABLE orders ADD COLUMN customer_id TEXT")
        if "customer_email" not in order_columns:
            conn.execute("ALTER TABLE orders ADD COLUMN customer_email TEXT")
        if "pix_txid" not in order_columns:
            conn.execute("ALTER TABLE orders ADD COLUMN pix_txid TEXT")
        if "pix_payload" not in order_columns:
            conn.execute("ALTER TABLE orders ADD COLUMN pix_payload TEXT")
        if "status_token" not in order_columns:
            conn.execute("ALTER TABLE orders ADD COLUMN status_token TEXT")
        if "status_updated_at" not in order_columns:
            conn.execute("ALTER TABLE orders ADD COLUMN status_updated_at TEXT")
        if "reset_code" not in customer_columns:
            conn.execute("ALTER TABLE customer_users ADD COLUMN reset_code TEXT")
        if "reset_requested_at" not in customer_columns:
            conn.execute("ALTER TABLE customer_users ADD COLUMN reset_requested_at TEXT")

        conn.commit()


def seed_data():
    with db_connection() as conn:
        user = conn.execute("SELECT id FROM admin_users WHERE username = ?", (DEFAULT_ADMIN_USER,)).fetchone()
        if not user:
            conn.execute(
                "INSERT INTO admin_users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                ("admin-1", DEFAULT_ADMIN_USER, hash_password(DEFAULT_ADMIN_PASSWORD), now_iso()),
            )

        products_total = conn.execute("SELECT COUNT(*) AS total FROM products").fetchone()["total"]
        promotions_total = conn.execute("SELECT COUNT(*) AS total FROM promotions").fetchone()["total"]

        if products_total == 0:
            for item in INITIAL_PRODUCTS:
                timestamp = now_iso()
                conn.execute(
                    """
                    INSERT INTO products (
                      id, name, description, category, category_label, price, stock, promo, combo, image, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item["id"],
                        item["name"],
                        item["description"],
                        item["category"],
                        item["categoryLabel"],
                        item["price"],
                        item["stock"],
                        1 if item["promo"] else 0,
                        1 if item["combo"] else 0,
                        item["image"],
                        timestamp,
                        timestamp,
                    ),
                )

        if promotions_total == 0:
            for promo in INITIAL_PROMOTIONS:
                timestamp = now_iso()
                conn.execute(
                    """
                    INSERT INTO promotions (id, tag, title, description, highlight, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        promo["id"],
                        promo["tag"],
                        promo["title"],
                        promo["description"],
                        promo["highlight"],
                        timestamp,
                        timestamp,
                    ),
                )

        conn.commit()


def import_legacy_json():
    if not LEGACY_JSON_PATH.exists():
        return
    with db_connection() as conn:
        has_orders = conn.execute("SELECT COUNT(*) AS total FROM orders").fetchone()["total"]
        if has_orders > 0:
            return
        legacy = json.loads(LEGACY_JSON_PATH.read_text(encoding="utf-8"))
        for order in legacy.get("orders", []):
            conn.execute(
                """
                INSERT OR IGNORE INTO orders (
                  id, created_at, mode, customer_name, phone, address, subtotal, delivery_fee, total, status, payment_method, payment_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order["id"],
                    order.get("createdAt", now_iso()),
                    order["mode"],
                    order["customerName"],
                    order["phone"],
                    order["address"],
                    float(order["subtotal"]),
                    float(order["deliveryFee"]),
                    float(order["total"]),
                    order.get("status", "confirmado"),
                    "pix",
                    "paid",
                ),
            )
            for item in order.get("items", []):
                conn.execute(
                    """
                    INSERT INTO order_items (order_id, product_id, name, price, quantity)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        order["id"],
                        item.get("id") or item.get("productId") or "",
                        item["name"],
                        float(item["price"]),
                        int(item["quantity"]),
                    ),
                )
        conn.commit()
    LEGACY_JSON_PATH.unlink(missing_ok=True)


def row_to_product(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "category": row["category"],
        "categoryLabel": row["category_label"],
        "price": row["price"],
        "stock": row["stock"],
        "promo": bool(row["promo"]),
        "combo": bool(row["combo"]),
        "image": row["image"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def row_to_promotion(row):
    return {
        "id": row["id"],
        "tag": row["tag"],
        "title": row["title"],
        "description": row["description"],
        "highlight": row["highlight"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def row_to_order(conn, row):
    item_rows = conn.execute(
        "SELECT product_id, name, price, quantity FROM order_items WHERE order_id = ? ORDER BY id",
        (row["id"],),
    ).fetchall()
    return {
        "id": row["id"],
        "number": row["id"].split("-")[-1][-3:],
        "createdAt": row["created_at"],
        "customerId": row["customer_id"],
        "customerEmail": row["customer_email"],
        "mode": row["mode"],
        "customerName": row["customer_name"],
        "phone": row["phone"],
        "address": row["address"],
        "subtotal": row["subtotal"],
        "deliveryFee": row["delivery_fee"],
        "total": row["total"],
        "status": row["status"],
        "statusLabel": ORDER_STATUSES.get(row["status"], row["status"]),
        "statusToken": row["status_token"] if "status_token" in row.keys() else None,
        "statusUpdatedAt": row["status_updated_at"] if "status_updated_at" in row.keys() else None,
        "paymentMethod": row["payment_method"],
        "paymentStatus": row["payment_status"],
        "pixTxid": row["pix_txid"] if "pix_txid" in row.keys() else None,
        "items": [
            {
                "id": item["product_id"],
                "productId": item["product_id"],
                "name": item["name"],
                "price": item["price"],
                "quantity": item["quantity"],
            }
            for item in item_rows
        ],
    }


def public_order_status(conn, row):
    order = row_to_order(conn, row)
    return {
        "id": order["id"],
        "number": order["number"],
        "createdAt": order["createdAt"],
        "status": order["status"],
        "statusLabel": order["statusLabel"],
        "statusUpdatedAt": order["statusUpdatedAt"],
        "total": order["total"],
        "items": order["items"],
    }


def dashboard_summary(conn):
    return {
        "totalProducts": conn.execute("SELECT COUNT(*) AS total FROM products").fetchone()["total"],
        "lowStock": conn.execute("SELECT COUNT(*) AS total FROM products WHERE stock > 0 AND stock <= 5").fetchone()["total"],
        "outOfStock": conn.execute("SELECT COUNT(*) AS total FROM products WHERE stock = 0").fetchone()["total"],
        "totalPromotions": conn.execute("SELECT COUNT(*) AS total FROM promotions").fetchone()["total"],
        "totalOrders": conn.execute("SELECT COUNT(*) AS total FROM orders").fetchone()["total"],
        "pendingPayments": conn.execute("SELECT COUNT(*) AS total FROM orders WHERE payment_status = 'pending'").fetchone()["total"],
    }


def fake_pix_emv(txid: str, total_centavos: int) -> str:
    valor = f"{total_centavos / 100:.2f}"
    return (
        "00020126580014BR.GOV.BCB.PIX"
        "52040000"
        "5303986"
        f"540{len(valor):02d}{valor}"
        "5802BR"
        "5910TOTEM BITE"
        "6009SAO PAULO"
        f"621305{txid}"
        "6304ABCD"
    )


def qr_png_base64(payload: str):
    if not qrcode:
        return None

    image = qrcode.make(payload)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def create_pix_payload(total_reais: float):
    total_centavos = int(round(float(total_reais) * 100))
    txid = uuid.uuid4().hex[:20].upper()
    payload = fake_pix_emv(txid, total_centavos)
    return {
        "txid": txid,
        "payload": payload,
        "pixCopiaECola": payload,
        "qrPngBase64": qr_png_base64(payload),
        "status": "PENDENTE",
        "sandbox": True,
    }


apply_migrations()
import_legacy_json()
seed_data()


class AppHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        try:
            status_code = int(args[1])
        except (IndexError, TypeError, ValueError):
            status_code = 0

        if self.command == "GET" and status_code < 400:
            return

        print(f"{self.command} {self.path} -> {status_code}")

    def _send_json(self, status_code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, file_path: Path):
        if not file_path.exists() or not file_path.is_file():
            self._send_json(404, {"error": "Arquivo nao encontrado."})
            return

        body = file_path.read_bytes()
        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        no_cache_files = {"index.html", "sw.js", "manifest.webmanifest", "instalar.html", "limpar.html"}
        cache_control = "no-cache, no-store, must-revalidate" if file_path.name in no_cache_files else "public, max-age=3600"
        self.send_header("Cache-Control", cache_control)
        if file_path.name == "limpar.html":
            self.send_header("Clear-Site-Data", '"cache", "storage"')
        self.end_headers()
        self.wfile.write(body)

    def _serve_static_app(self, path: str):
        if path == "/":
            self._send_file(DIST_DIR / "index.html")
            return

        requested = (DIST_DIR / path.lstrip("/")).resolve()
        try:
            requested.relative_to(DIST_DIR.resolve())
        except ValueError:
            self._send_json(403, {"error": "Caminho invalido."})
            return

        if requested.exists() and requested.is_file():
            self._send_file(requested)
            return

        self._send_file(DIST_DIR / "index.html")

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _bearer_token(self):
        header = self.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            return header[7:]
        return ""

    def _require_auth(self):
        token = self._bearer_token()
        if not verify_token(token):
            self._send_json(401, {"error": "Autenticacao obrigatoria."})
            return False
        return True

    def _require_admin_auth(self):
        payload = decode_token(self._bearer_token())
        if not payload or payload["type"] != "admin":
            self._send_json(401, {"error": "Autenticacao administrativa obrigatoria."})
            return None
        return payload

    def _require_customer_auth(self):
        payload = decode_token(self._bearer_token())
        if not payload or payload["type"] != "customer":
            self._send_json(401, {"error": "Login de cliente obrigatorio."})
            return None
        return payload

    def do_OPTIONS(self):
        self._send_json(204, {})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        with db_connection() as conn:
            if path == "/api/health":
                self._send_json(200, {"status": "ok"})
                return

            if path == "/api/products":
                rows = conn.execute("SELECT * FROM products ORDER BY created_at DESC").fetchall()
                self._send_json(200, [row_to_product(row) for row in rows])
                return

            if path == "/api/promotions":
                rows = conn.execute("SELECT * FROM promotions ORDER BY created_at DESC").fetchall()
                self._send_json(200, [row_to_promotion(row) for row in rows])
                return

            if path == "/api/orders":
                if not self._require_admin_auth():
                    return
                rows = conn.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50").fetchall()
                self._send_json(200, [row_to_order(conn, row) for row in rows])
                return

            if path == "/api/kitchen/orders":
                rows = conn.execute(
                    """
                    SELECT * FROM orders
                    WHERE status IN ('received', 'preparing', 'ready')
                    ORDER BY created_at ASC
                    LIMIT 50
                    """
                ).fetchall()
                self._send_json(
                    200,
                    {
                        "statuses": ORDER_STATUSES,
                        "orders": [row_to_order(conn, row) for row in rows],
                    },
                )
                return

            if path.startswith("/api/status/"):
                token = path.split("/")[-1]
                row = conn.execute(
                    "SELECT * FROM orders WHERE status_token = ? LIMIT 1",
                    (token,),
                ).fetchone()
                if not row:
                    self._send_json(404, {"error": "Pedido nao encontrado."})
                    return
                self._send_json(200, public_order_status(conn, row))
                return

            if path == "/api/dashboard":
                if not self._require_admin_auth():
                    return
                self._send_json(200, dashboard_summary(conn))
                return

            if path == "/api/customers/me":
                customer_auth = self._require_customer_auth()
                if not customer_auth:
                    return
                row = conn.execute(
                    "SELECT id, name, email, phone, created_at FROM customer_users WHERE id = ?",
                    (customer_auth["subject"],),
                ).fetchone()
                if not row:
                    self._send_json(404, {"error": "Cliente nao encontrado."})
                    return
                self._send_json(
                    200,
                    {
                        "id": row["id"],
                        "name": row["name"],
                        "email": row["email"],
                        "phone": row["phone"],
                        "createdAt": row["created_at"],
                    },
                )
                return

            if path == "/api/customers/orders":
                customer_auth = self._require_customer_auth()
                if not customer_auth:
                    return
                rows = conn.execute(
                    "SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10",
                    (customer_auth["subject"],),
                ).fetchall()
                self._send_json(200, [row_to_order(conn, row) for row in rows])
                return

            if path == "/api/customers/lookup":
                query = parse_qs(parsed.query)
                phone_digits = "".join(filter(str.isdigit, query.get("phone", [""])[0]))
                if len(phone_digits) < 8:
                    self._send_json(400, {"error": "Informe um celular valido."})
                    return
                rows = conn.execute("SELECT id, name, email, phone FROM customer_users").fetchall()
                for row in rows:
                    row_digits = "".join(filter(str.isdigit, row["phone"] or ""))
                    if row_digits.endswith(phone_digits[-8:]) or phone_digits.endswith(row_digits[-8:]):
                        self._send_json(
                            200,
                            {
                                "exists": True,
                                "customer": {
                                    "name": row["name"],
                                    "email": row["email"],
                                    "phone": row["phone"],
                                },
                            },
                        )
                        return
                self._send_json(200, {"exists": False})
                return

            if path == "/api/meta":
                self._send_json(
                    200,
                    {
                        "categories": CATEGORIES,
                        "adminUser": DEFAULT_ADMIN_USER,
                        "paymentMethods": PAYMENT_METHODS,
                    },
                )
                return

            if path.startswith("/api/pix/status/"):
                txid = path.split("/")[-1]
                row = conn.execute(
                    "SELECT id, payment_status FROM orders WHERE pix_txid = ? LIMIT 1",
                    (txid,),
                ).fetchone()
                self._send_json(
                    200,
                    {
                        "txid": txid,
                        "status": "CONCLUIDO" if row and row["payment_status"] == "paid" else "PENDENTE",
                        "orderId": row["id"] if row else None,
                    },
                )
                return

            self._serve_static_app(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json()

        with db_connection() as conn:
            if path == "/api/admin/login":
                row = conn.execute(
                    "SELECT username, password_hash FROM admin_users WHERE username = ?",
                    (body.get("username", ""),),
                ).fetchone()
                if not row or row["password_hash"] != hash_password(body.get("password", "")):
                    self._send_json(401, {"error": "Usuario ou senha invalidos."})
                    return
                self._send_json(
                    200,
                    {
                        "token": sign_token(row["username"], "admin"),
                        "user": {"username": row["username"]},
                    },
                )
                return

            if path == "/api/customers/register-code":
                email = body.get("email", "").strip().lower()
                name = body.get("name", "").strip()
                if not name or not email:
                    self._send_json(400, {"error": "Informe nome e e-mail para enviar o codigo."})
                    return
                existing = conn.execute(
                    "SELECT id FROM customer_users WHERE email = ?",
                    (email,),
                ).fetchone()
                if existing:
                    self._send_json(409, {"error": "Ja existe cadastro com esse e-mail. Entre com sua senha."})
                    return
                verification_code = f"{secrets.randbelow(900000) + 100000}"
                conn.execute(
                    """
                    INSERT INTO customer_email_verifications (email, code, requested_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(email) DO UPDATE SET code = excluded.code, requested_at = excluded.requested_at
                    """,
                    (email, verification_code, now_iso()),
                )
                conn.commit()
                self._send_json(
                    200,
                    {
                        "message": "Codigo enviado para o e-mail informado.",
                        "email": email,
                        "devEmailCode": verification_code,
                    },
                )
                return

            if path == "/api/customers/register":
                email = body.get("email", "").strip().lower()
                if not body.get("name", "").strip() or not email or not body.get("phone", "").strip() or not body.get("password", "").strip():
                    self._send_json(400, {"error": "Preencha nome, e-mail, celular e senha."})
                    return
                verification_code = body.get("verificationCode", "").strip()
                if verification_code:
                    verification = conn.execute(
                        "SELECT code FROM customer_email_verifications WHERE email = ?",
                        (email,),
                    ).fetchone()
                    if not verification or verification["code"] != verification_code:
                        self._send_json(400, {"error": "Codigo de e-mail invalido."})
                        return
                existing = conn.execute(
                    "SELECT id FROM customer_users WHERE email = ?",
                    (email,),
                ).fetchone()
                if existing:
                    self._send_json(409, {"error": "Ja existe cadastro com esse e-mail."})
                    return
                customer_id = f"customer-{int(datetime.utcnow().timestamp() * 1000)}"
                timestamp = now_iso()
                conn.execute(
                    """
                    INSERT INTO customer_users (id, name, email, phone, password_hash, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        customer_id,
                        body["name"].strip(),
                        email,
                        body["phone"].strip(),
                        hash_password(body["password"].strip()),
                        timestamp,
                    ),
                )
                conn.execute("DELETE FROM customer_email_verifications WHERE email = ?", (email,))
                conn.commit()
                self._send_json(
                    201,
                    {
                        "token": sign_token(customer_id, "customer"),
                        "customer": {
                            "id": customer_id,
                            "name": body["name"].strip(),
                            "email": email,
                            "phone": body["phone"].strip(),
                        },
                    },
                )
                return

            if path == "/api/customers/login":
                email = body.get("email", "").strip().lower()
                password = body.get("password", "").strip()
                row = conn.execute(
                    "SELECT id, name, email, phone, password_hash FROM customer_users WHERE email = ?",
                    (email,),
                ).fetchone()
                if not row or row["password_hash"] != hash_password(password):
                    self._send_json(401, {"error": "E-mail ou senha invalidos."})
                    return
                self._send_json(
                    200,
                    {
                        "token": sign_token(row["id"], "customer"),
                        "customer": {
                            "id": row["id"],
                            "name": row["name"],
                            "email": row["email"],
                            "phone": row["phone"],
                        },
                    },
                )
                return

            if path == "/api/customers/forgot-password":
                email = body.get("email", "").strip().lower()
                if not email:
                    self._send_json(400, {"error": "Informe o e-mail cadastrado."})
                    return
                row = conn.execute(
                    "SELECT id FROM customer_users WHERE email = ?",
                    (email,),
                ).fetchone()
                if not row:
                    self._send_json(404, {"error": "Nao encontramos cliente com esse e-mail."})
                    return
                reset_code = f"{secrets.randbelow(900000) + 100000}"
                conn.execute(
                    """
                    UPDATE customer_users
                    SET reset_code = ?, reset_requested_at = ?
                    WHERE email = ?
                    """,
                    (reset_code, now_iso(), email),
                )
                conn.commit()
                self._send_json(
                    200,
                    {
                        "message": "Codigo de recuperacao gerado. Use-o para definir uma nova senha.",
                        "email": email,
                        "devResetCode": reset_code,
                    },
                )
                return

            if path == "/api/customers/reset-password":
                email = body.get("email", "").strip().lower()
                code = body.get("code", "").strip()
                new_password = body.get("newPassword", "").strip()
                if not email or not code or not new_password:
                    self._send_json(400, {"error": "Informe e-mail, codigo e nova senha."})
                    return
                row = conn.execute(
                    """
                    SELECT id, reset_code
                    FROM customer_users
                    WHERE email = ?
                    """,
                    (email,),
                ).fetchone()
                if not row or not row["reset_code"] or row["reset_code"] != code:
                    self._send_json(400, {"error": "Codigo de recuperacao invalido."})
                    return
                conn.execute(
                    """
                    UPDATE customer_users
                    SET password_hash = ?, reset_code = NULL, reset_requested_at = NULL
                    WHERE id = ?
                    """,
                    (hash_password(new_password), row["id"]),
                )
                conn.commit()
                self._send_json(200, {"message": "Senha atualizada com sucesso."})
                return

            if path == "/api/products":
                if not self._require_admin_auth():
                    return
                timestamp = now_iso()
                conn.execute(
                    """
                    INSERT INTO products (
                      id, name, description, category, category_label, price, stock, promo, combo, image, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        body["id"],
                        body["name"],
                        body["description"],
                        body["category"],
                        body["categoryLabel"],
                        float(body["price"]),
                        int(body["stock"]),
                        1 if body["promo"] else 0,
                        1 if body["combo"] else 0,
                        body["image"],
                        timestamp,
                        timestamp,
                    ),
                )
                conn.commit()
                self._send_json(201, {"ok": True})
                return

            if path == "/api/promotions":
                if not self._require_admin_auth():
                    return
                timestamp = now_iso()
                conn.execute(
                    """
                    INSERT INTO promotions (id, tag, title, description, highlight, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        body["id"],
                        body["tag"],
                        body["title"],
                        body["description"],
                        body["highlight"],
                        timestamp,
                        timestamp,
                    ),
                )
                conn.commit()
                self._send_json(201, {"ok": True})
                return

            if path == "/api/orders":
                order_id = f"pedido-{int(datetime.utcnow().timestamp() * 1000)}"
                timestamp = now_iso()
                payment_method = body.get("paymentMethod", "pix")
                payment_payload = create_pix_payload(float(body["total"])) if payment_method == "pix" else None
                payment_status = body.get("paymentStatus", "paid")
                status_token = secrets.token_urlsafe(12)
                customer_auth = decode_token(self._bearer_token())
                customer_id = None
                customer_email = None
                if customer_auth and customer_auth["type"] == "customer":
                    customer_row = conn.execute(
                        "SELECT id, email FROM customer_users WHERE id = ?",
                        (customer_auth["subject"],),
                    ).fetchone()
                    if customer_row:
                        customer_id = customer_row["id"]
                        customer_email = customer_row["email"]
                conn.execute(
                    """
                    INSERT INTO orders (
                      id, created_at, customer_id, customer_email, mode, customer_name, phone, address, subtotal, delivery_fee, total, status, payment_method, payment_status, pix_txid, pix_payload, status_token, status_updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        order_id,
                        timestamp,
                        customer_id,
                        customer_email,
                        body["mode"],
                        body["customerName"],
                        body["phone"],
                        body["address"],
                        float(body["subtotal"]),
                        float(body["deliveryFee"]),
                        float(body["total"]),
                        "received",
                        payment_method,
                        payment_status,
                        payment_payload["txid"] if payment_payload else None,
                        payment_payload["payload"] if payment_payload else None,
                        status_token,
                        timestamp,
                    ),
                )

                for item in body.get("items", []):
                    conn.execute(
                        """
                        INSERT INTO order_items (order_id, product_id, name, price, quantity)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            order_id,
                            item["id"],
                            item["name"],
                            float(item["price"]),
                            int(item["quantity"]),
                        ),
                    )
                    conn.execute(
                        """
                        UPDATE products
                        SET stock = CASE WHEN stock - ? < 0 THEN 0 ELSE stock - ? END,
                            updated_at = ?
                        WHERE id = ?
                        """,
                        (int(item["quantity"]), int(item["quantity"]), timestamp, item["id"]),
                    )
                conn.commit()

                row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
                self._send_json(
                    201,
                    {
                        "ok": True,
                        "id": order_id,
                        "order": row_to_order(conn, row),
                        "statusUrl": f"/s/{status_token}",
                        "payment": payment_payload,
                    },
                )
                return

            self._send_json(404, {"error": "Rota nao encontrada."})

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json()

        if path.startswith("/api/kitchen/orders/") and path.endswith("/status"):
            order_id = path.split("/")[-2]
            next_status = body.get("status", "")
            if next_status not in ORDER_STATUSES:
                self._send_json(400, {"error": "Status invalido."})
                return
            with db_connection() as conn:
                conn.execute(
                    "UPDATE orders SET status = ?, status_updated_at = ? WHERE id = ?",
                    (next_status, now_iso(), order_id),
                )
                conn.commit()
                row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
                if not row:
                    self._send_json(404, {"error": "Pedido nao encontrado."})
                    return
                self._send_json(200, row_to_order(conn, row))
                return

        if not self._require_admin_auth():
            return

        with db_connection() as conn:
            if path.startswith("/api/products/"):
                product_id = path.split("/")[-1]
                conn.execute(
                    """
                    UPDATE products
                    SET name = ?, description = ?, category = ?, category_label = ?, price = ?, stock = ?, promo = ?, combo = ?, image = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        body["name"],
                        body["description"],
                        body["category"],
                        body["categoryLabel"],
                        float(body["price"]),
                        int(body["stock"]),
                        1 if body["promo"] else 0,
                        1 if body["combo"] else 0,
                        body["image"],
                        now_iso(),
                        product_id,
                    ),
                )
                conn.commit()
                self._send_json(200, {"ok": True})
                return

            if path.startswith("/api/promotions/"):
                promotion_id = path.split("/")[-1]
                conn.execute(
                    """
                    UPDATE promotions
                    SET tag = ?, title = ?, description = ?, highlight = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        body["tag"],
                        body["title"],
                        body["description"],
                        body["highlight"],
                        now_iso(),
                        promotion_id,
                    ),
                )
                conn.commit()
                self._send_json(200, {"ok": True})
                return

            if path.startswith("/api/orders/") and path.endswith("/payment"):
                order_id = path.split("/")[-2]
                conn.execute(
                    "UPDATE orders SET payment_status = ?, status = ? WHERE id = ?",
                    ("paid", "confirmado", order_id),
                )
                conn.commit()
                self._send_json(200, {"ok": True})
                return

            self._send_json(404, {"error": "Rota nao encontrada."})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if not self._require_auth():
            return

        with db_connection() as conn:
            if path.startswith("/api/products/"):
                product_id = path.split("/")[-1]
                conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
                conn.commit()
                self._send_json(200, {"ok": True})
                return

            if path.startswith("/api/promotions/"):
                promotion_id = path.split("/")[-1]
                conn.execute("DELETE FROM promotions WHERE id = ?", (promotion_id,))
                conn.commit()
                self._send_json(200, {"ok": True})
                return

            self._send_json(404, {"error": "Rota nao encontrada."})


def main():
    server = ThreadingHTTPServer(("0.0.0.0", SERVER_PORT), AppHandler)
    print(f"Pedido Direto API Python ativa em http://localhost:{SERVER_PORT}")
    print(f"Login admin inicial: {DEFAULT_ADMIN_USER} / {DEFAULT_ADMIN_PASSWORD}")
    print(f"Banco SQLite em {SQLITE_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
