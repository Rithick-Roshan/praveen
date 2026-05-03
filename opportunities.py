from flask import Blueprint, request, jsonify, session
from database import get_db
import json
from datetime import datetime, timezone
from functools import wraps

opp_bp = Blueprint("opportunities", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# Auth guard decorator
# ─────────────────────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "admin_id" not in session:
            return jsonify({"success": False, "message": "Authentication required."}), 401
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_FIELDS = ["name", "duration", "start_date", "description", "skills", "category", "future_opportunities"]
VALID_CATEGORIES = {"technology", "business", "design", "marketing", "data", "other"}


def _row_to_dict(row) -> dict:
    """Convert a sqlite3.Row to a plain dict with skills parsed."""
    d = dict(row)
    try:
        d["skills"] = json.loads(d["skills"])
    except (json.JSONDecodeError, TypeError):
        d["skills"] = []
    return d


def _validate_opportunity(data: dict) -> dict:
    """Return a dict of field → error message for any validation failures."""
    errors = {}

    for field in REQUIRED_FIELDS:
        if not data.get(field):
            errors[field] = f"{field.replace('_', ' ').title()} is required."

    # Skills must be a non-empty list or non-empty comma-separated string
    skills_raw = data.get("skills", "")
    if isinstance(skills_raw, str):
        skills = [s.strip() for s in skills_raw.split(",") if s.strip()]
    elif isinstance(skills_raw, list):
        skills = [s.strip() for s in skills_raw if str(s).strip()]
    else:
        skills = []

    if not skills:
        errors["skills"] = "At least one skill is required."

    # Category validation
    category = (data.get("category") or "").strip().lower()
    if category and category not in VALID_CATEGORIES:
        errors["category"] = f"Category must be one of: {', '.join(sorted(VALID_CATEGORIES))}."

    # max_applicants must be a positive integer if provided
    max_app = data.get("max_applicants")
    if max_app not in (None, "", 0):
        try:
            val = int(max_app)
            if val <= 0:
                errors["max_applicants"] = "Maximum applicants must be a positive number."
        except (ValueError, TypeError):
            errors["max_applicants"] = "Maximum applicants must be a valid number."

    return errors


def _parse_skills(raw) -> list:
    if isinstance(raw, list):
        return [s.strip() for s in raw if str(s).strip()]
    return [s.strip() for s in str(raw).split(",") if s.strip()]


# ─────────────────────────────────────────────────────────────────────────────
# US-2.1 / US-2.2 / US-2.3  List + Create
# ─────────────────────────────────────────────────────────────────────────────

@opp_bp.route("/", methods=["GET", "POST"])
@login_required
def opportunities():
    admin_id = session["admin_id"]

    # ── GET: list all opportunities for this admin ────────────────────────────
    if request.method == "GET":
        conn = get_db()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """SELECT * FROM opportunities
                   WHERE admin_id = ?
                   ORDER BY created_at DESC""",
                (admin_id,)
            )
            rows = cursor.fetchall()
            return jsonify({
                "success": True,
                "opportunities": [_row_to_dict(r) for r in rows]
            }), 200
        finally:
            conn.close()

    # ── POST: create a new opportunity ───────────────────────────────────────
    data   = request.get_json(silent=True) or {}
    errors = _validate_opportunity(data)
    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    skills     = _parse_skills(data["skills"])
    max_app    = data.get("max_applicants")
    max_app_int = int(max_app) if max_app not in (None, "") else None

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO opportunities
               (admin_id, name, duration, start_date, description, skills,
                category, future_opportunities, max_applicants)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                admin_id,
                data["name"].strip(),
                data["duration"].strip(),
                data["start_date"].strip(),
                data["description"].strip(),
                json.dumps(skills),
                data["category"].strip().lower(),
                data["future_opportunities"].strip(),
                max_app_int,
            )
        )
        conn.commit()
        new_id = cursor.lastrowid

        cursor.execute("SELECT * FROM opportunities WHERE id = ?", (new_id,))
        new_row = cursor.fetchone()
        return jsonify({
            "success": True,
            "message": "Opportunity created successfully.",
            "opportunity": _row_to_dict(new_row)
        }), 201

    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# US-2.4 / US-2.5 / US-2.6  Get one + Update + Delete
# ─────────────────────────────────────────────────────────────────────────────

@opp_bp.route("/<int:opp_id>", methods=["GET", "PUT", "DELETE"])
@login_required
def opportunity_detail(opp_id: int):
    admin_id = session["admin_id"]
    conn     = get_db()

    try:
        cursor = conn.cursor()

        # Fetch and ownership check (US-2.3, US-2.6)
        cursor.execute(
            "SELECT * FROM opportunities WHERE id = ?",
            (opp_id,)
        )
        row = cursor.fetchone()

        if row is None:
            return jsonify({"success": False, "message": "Opportunity not found."}), 404

        if row["admin_id"] != admin_id:
            return jsonify({"success": False, "message": "Access denied."}), 403

        # ── GET: return full details ──────────────────────────────────────────
        if request.method == "GET":
            return jsonify({"success": True, "opportunity": _row_to_dict(row)}), 200

        # ── PUT: update ───────────────────────────────────────────────────────
        if request.method == "PUT":
            data   = request.get_json(silent=True) or {}
            errors = _validate_opportunity(data)
            if errors:
                return jsonify({"success": False, "errors": errors}), 400

            skills     = _parse_skills(data["skills"])
            max_app    = data.get("max_applicants")
            max_app_int = int(max_app) if max_app not in (None, "") else None
            updated_at  = datetime.now(timezone.utc).isoformat()

            cursor.execute(
                """UPDATE opportunities
                   SET name=?, duration=?, start_date=?, description=?, skills=?,
                       category=?, future_opportunities=?, max_applicants=?, updated_at=?
                   WHERE id=?""",
                (
                    data["name"].strip(),
                    data["duration"].strip(),
                    data["start_date"].strip(),
                    data["description"].strip(),
                    json.dumps(skills),
                    data["category"].strip().lower(),
                    data["future_opportunities"].strip(),
                    max_app_int,
                    updated_at,
                    opp_id,
                )
            )
            conn.commit()

            cursor.execute("SELECT * FROM opportunities WHERE id = ?", (opp_id,))
            updated_row = cursor.fetchone()
            return jsonify({
                "success": True,
                "message": "Opportunity updated successfully.",
                "opportunity": _row_to_dict(updated_row)
            }), 200

        # ── DELETE ────────────────────────────────────────────────────────────
        if request.method == "DELETE":
            cursor.execute("DELETE FROM opportunities WHERE id = ?", (opp_id,))
            conn.commit()
            return jsonify({
                "success": True,
                "message": "Opportunity deleted successfully."
            }), 200

    finally:
        conn.close()