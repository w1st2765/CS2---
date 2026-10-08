import hashlib
import json
import re
import secrets
import sqlite3
import time
import urllib.parse
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / "site.db"
PORT = 8000

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT DEFAULT '',
    steam_id TEXT DEFAULT '',
    avatar_color TEXT DEFAULT '#f7b731',
    avatar_emoji TEXT DEFAULT '🎯',
    accent_color TEXT DEFAULT '#f7b731',
    rank TEXT DEFAULT 'Silver I',
    fav_map TEXT DEFAULT '',
    fav_weapon TEXT DEFAULT '',
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    hours INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
"""

AVATAR_EMOJI = ["🎯", "💀", "🔥", "⚡", "🗡️", "🛡️", "🦅", "🐺", "🐱", "🤖", "👽", "🦖"]
MAPS = [
    "Dust II", "Mirage", "Inferno", "Nuke", "Overpass",
    "Ancient", "Anubis", "Train", "Vertigo", "Office",
]
WEAPONS = ["AK-47", "M4A4", "M4A1-S", "AWP", "Desert Eagle", "Glock-18",
           "USP-S", "MP9", "MP5-SD", "Galil AR", "FAMAS", "SSG 08"]


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect() as conn:
        conn.executescript(SCHEMA)


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()


def public_user(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "bio": row["bio"],
        "steam_id": row["steam_id"],
        "avatar_color": row["avatar_color"],
        "avatar_emoji": row["avatar_emoji"],
        "accent_color": row["accent_color"],
        "rank": row["rank"],
        "fav_map": row["fav_map"],
        "fav_weapon": row["fav_weapon"],
        "kills": row["kills"],
        "deaths": row["deaths"],
        "wins": row["wins"],
        "hours": row["hours"],
        "kd": round(row["kills"] / row["deaths"], 2) if row["deaths"] else float(row["kills"]),
        "created_at": row["created_at"],
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "CS2Site/1.0"

    def log_message(self, fmt, *args):
        pass

    # ---------- helpers ----------
    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path, content_type):
        if not path.is_file():
            self.send_json({"error": "not found"}, 404)
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            return {}

    def current_user(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("token")
        if not morsel:
            return None
        with connect() as conn:
            row = conn.execute(
                "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?",
                (morsel.value,),
            ).fetchone()
        return row

    def set_cookie(self, token, max_age):
        self.send_header(
            "Set-Cookie", f"token={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}"
        )

    # ---------- routing ----------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/static/"):
            rel = path[len("/static/"):]
            target = (BASE / "static" / rel).resolve()
            if not str(target).startswith(str((BASE / "static").resolve())):
                return self.send_json({"error": "forbidden"}, 403)
            types = {".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                     ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon"}
            return self.send_file(target, types.get(target.suffix, "application/octet-stream"))

        if path == "/":
            return self.send_file(BASE / "index.html", "text/html; charset=utf-8")

        if path == "/api/me":
            row = self.current_user()
            return self.send_json({"user": public_user(row)} if row else {"user": None})

        if path == "/api/options":
            return self.send_json({"maps": MAPS, "weapons": WEAPONS, "avatars": AVATAR_EMOJI})

        if path == "/api/leaderboard":
            with connect() as conn:
                rows = conn.execute(
                    "SELECT * FROM users ORDER BY wins DESC, kills DESC LIMIT 20"
                ).fetchall()
            return self.send_json({"users": [public_user(r) for r in rows]})

        if path.startswith("/api/user/"):
            try:
                uid = int(path.rsplit("/", 1)[1])
            except ValueError:
                return self.send_json({"error": "bad id"}, 400)
            with connect() as conn:
                row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
            if not row:
                return self.send_json({"error": "not found"}, 404)
            return self.send_json({"user": public_user(row)})

        return self.send_json({"error": "not found"}, 404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        body = self.read_body()

        if path == "/api/register":
            return self.register(body)
        if path == "/api/login":
            return self.login(body)
        if path == "/api/logout":
            return self.logout()
        if path == "/api/profile":
            return self.update_profile(body)
        return self.send_json({"error": "not found"}, 404)

    # ---------- auth ----------
    def register(self, body):
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        if not re.fullmatch(r"[A-Za-z0-9_]{3,20}", username):
            return self.send_json({"error": "Ник: 3-20 символов, латиница/цифры/_"}, 400)
        if len(password) < 4:
            return self.send_json({"error": "Пароль от 4 символов"}, 400)
        salt = secrets.token_hex(16)
        try:
            with connect() as conn:
                cur = conn.execute(
                    "INSERT INTO users (username, password_hash, salt, display_name, created_at)"
                    " VALUES (?, ?, ?, ?, ?)",
                    (username, hash_password(password, salt), salt, username, int(time.time())),
                )
                uid = cur.lastrowid
                token = secrets.token_hex(32)
                conn.execute(
                    "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
                    (token, uid, int(time.time())),
                )
        except sqlite3.IntegrityError:
            return self.send_json({"error": "Такой ник уже занят"}, 400)

        row = self.get_user(uid)
        payload = json.dumps({"user": public_user(row)}, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.set_cookie(token, 60 * 60 * 24 * 30)
        self.end_headers()
        self.wfile.write(payload)

    def login(self, body):
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        with connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            if not row or row["password_hash"] != hash_password(password, row["salt"]):
                return self.send_json({"error": "Неверный ник или пароль"}, 401)
            token = secrets.token_hex(32)
            conn.execute(
                "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
                (token, row["id"], int(time.time())),
            )
        payload = json.dumps({"user": public_user(row)}, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.set_cookie(token, 60 * 60 * 24 * 30)
        self.end_headers()
        self.wfile.write(payload)

    def logout(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("token")
        if morsel:
            with connect() as conn:
                conn.execute("DELETE FROM sessions WHERE token = ?", (morsel.value,))
        payload = json.dumps({"ok": True}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.set_cookie("", 0)
        self.end_headers()
        self.wfile.write(payload)

    def get_user(self, uid):
        with connect() as conn:
            return conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()

    # ---------- profile ----------
    def update_profile(self, body):
        row = self.current_user()
        if not row:
            return self.send_json({"error": "Войдите в аккаунт"}, 401)

        fields = {
            "display_name": lambda v: str(v)[:24],
            "bio": lambda v: str(v)[:200],
            "steam_id": lambda v: str(v)[:32],
            "avatar_color": lambda v: v if re.fullmatch(r"#[0-9a-fA-F]{6}", str(v)) else None,
            "accent_color": lambda v: v if re.fullmatch(r"#[0-9a-fA-F]{6}", str(v)) else None,
            "rank": lambda v: str(v)[:24],
            "fav_map": lambda v: str(v)[:24],
            "fav_weapon": lambda v: str(v)[:24],
        }

        updates, values = [], []
        for key, clean in fields.items():
            if key in body:
                val = clean(body[key])
                if val is None:
                    return self.send_json({"error": f"Некорректное значение: {key}"}, 400)
                updates.append(f"{key} = ?")
                values.append(val)
        if "avatar_emoji" in body:
            emoji = str(body["avatar_emoji"])[:4]
            if emoji not in AVATAR_EMOJI:
                return self.send_json({"error": "Такого аватара нет"}, 400)
            updates.append("avatar_emoji = ?")
            values.append(emoji)
        if "password" in body and body["password"]:
            if len(body["password"]) < 4:
                return self.send_json({"error": "Пароль от 4 символов"}, 400)
            salt = secrets.token_hex(16)
            updates += ["password_hash = ?", "salt = ?"]
            values += [hash_password(body["password"], salt), salt]

        if not updates:
            return self.send_json({"error": "Нечего менять"}, 400)

        values.append(row["id"])
        with connect() as conn:
            conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", values)
        updated = self.get_user(row["id"])
        return self.send_json({"user": public_user(updated)})


def main():
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"CS2 сайт запущен: http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановлено")


if __name__ == "__main__":
    main()
