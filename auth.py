from flask import Blueprint, request, jsonify, session
from database import get_db
import bcrypt
import secrets
from datetime import datetime, timedelta, timezone

auth_bp = Blueprint("auth", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helper utilities
# ─────────────────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _admin_by_email(cursor, email: str):
    cursor.execute("SELECT * FROM admins WHERE email = ?", (email.strip().lower(),))
    return cursor.fetchone()


# ─────────────────────────────────────────────────────────────────────────────
# US-1.1  Admin Sign Up
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    full_name        = (data.get("full_name") or "").strip()
    email            = (data.get("email") or "").strip().lower()
    password         = (data.get("password") or "")
    confirm_password = (data.get("confirm_password") or "")

    # ── Validate ──────────────────────────────────────────────────────────────
    errors = {}

    if not full_name:
        errors["full_name"] = "Full name is required."

    if not email or "@" not in email or "." not in email.split("@")[-1]:
        errors["email"] = "A valid email address is required."

    if not password or len(password) < 8:
        errors["password"] = "Password must be at least 8 characters."

    if password != confirm_password:
        errors["confirm_password"] = "Passwords do not match."

    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    # ── Persist ───────────────────────────────────────────────────────────────
    conn = get_db()
    try:
        cursor = conn.cursor()

        if _admin_by_email(cursor, email):
            return jsonify({
                "success": False,
                "errors": {"email": "An account with this email already exists."}
            }), 409

        cursor.execute(
            "INSERT INTO admins (full_name, email, password) VALUES (?, ?, ?)",
            (full_name, email, _hash_password(password))
        )
        conn.commit()
        return jsonify({"success": True, "message": "Account created successfully."}), 201

    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# US-1.2  Admin Login
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    data        = request.get_json(silent=True) or {}
    email       = (data.get("email") or "").strip().lower()
    password    = (data.get("password") or "")
    remember_me = bool(data.get("remember_me", False))

    # Generic error – never reveal which field failed (US-1.2)
    GENERIC_ERROR = {"success": False, "errors": {"general": "Invalid email or password."}}

    if not email or not password:
        return jsonify(GENERIC_ERROR), 401

    conn = get_db()
    try:
        cursor = conn.cursor()
        admin  = _admin_by_email(cursor, email)

        if admin is None or not _check_password(password, admin["password"]):
            return jsonify(GENERIC_ERROR), 401

        # ── Start session ──────────────────────────────────────────────────
        session.permanent = remember_me      # long-lived only when checked
        session["admin_id"]   = admin["id"]
        session["admin_email"] = admin["email"]
        session["admin_name"]  = admin["full_name"]

        return jsonify({
            "success": True,
            "admin": {
                "id":        admin["id"],
                "full_name": admin["full_name"],
                "email":     admin["email"],
            }
        }), 200

    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# US-1.3  Forgot Password
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    # Always return the same message regardless of whether email exists (privacy)
    PRIVACY_RESPONSE = jsonify({
        "success": True,
        "message": "If that email is registered, a reset link has been sent."
    }), 200

    if not email or "@" not in email:
        return PRIVACY_RESPONSE   # still 200 – don't leak info

    conn = get_db()
    try:
        cursor = conn.cursor()
        admin  = _admin_by_email(cursor, email)

        if admin:
            token      = secrets.token_urlsafe(48)
            expires_at = (
                datetime.now(timezone.utc) + timedelta(hours=1)
            ).isoformat()

            cursor.execute(
                """INSERT INTO password_reset_tokens (admin_id, token, expires_at)
                   VALUES (?, ?, ?)""",
                (admin["id"], token, expires_at)
            )
            conn.commit()

            # In production you would send an email here.
            # For now we just log the link internally.
            reset_link = f"http://localhost:5000/api/auth/reset-password?token={token}"
            print(f"[PASSWORD RESET] Link for {email}: {reset_link}")

    finally:
        conn.close()

    return PRIVACY_RESPONSE


# ─────────────────────────────────────────────────────────────────────────────
# Reset-password endpoint (validates the token from the link)
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data         = request.get_json(silent=True) or {}
    token        = (data.get("token") or "").strip()
    new_password = (data.get("new_password") or "")

    if not token or not new_password or len(new_password) < 8:
        return jsonify({"success": False, "message": "Invalid request."}), 400

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0",
            (token,)
        )
        record = cursor.fetchone()

        if record is None:
            return jsonify({"success": False, "message": "Reset link is invalid or has already been used."}), 400

        # Check expiry
        expires_at = datetime.fromisoformat(record["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            return jsonify({"success": False, "message": "Reset link has expired. Please request a new one."}), 400

        # Update password and mark token as used
        cursor.execute(
            "UPDATE admins SET password = ? WHERE id = ?",
            (_hash_password(new_password), record["admin_id"])
        )
        cursor.execute(
            "UPDATE password_reset_tokens SET used = 1 WHERE id = ?",
            (record["id"],)
        )
        conn.commit()

        return jsonify({"success": True, "message": "Password reset successfully. You may now log in."}), 200

    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Logout
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully."}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Session check (useful for frontend to verify current session)
# ─────────────────────────────────────────────────────────────────────────────

@auth_bp.route("/me", methods=["GET"])
def me():
    if "admin_id" not in session:
        return jsonify({"success": False, "message": "Not authenticated."}), 401

    return jsonify({
        "success": True,
        "admin": {
            "id":        session["admin_id"],
            "full_name": session["admin_name"],
            "email":     session["admin_email"],
        }
    }), 200