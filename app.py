from flask import Flask, send_from_directory
from flask_cors import CORS
from datetime import timedelta
import os

from database import init_db
from auth import auth_bp
from opportunities import opp_bp

app = Flask(__name__, static_folder=".", static_url_path="")
app.secret_key = "qf-admin-secret-key-demo"
app.permanent_session_lifetime = timedelta(days=30)

CORS(app, supports_credentials=True, origins=["*"])

# Register blueprints
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(opp_bp, url_prefix="/api/opportunities")

# Initialize DB on startup
with app.app_context():
    init_db()

# Serve the frontend
@app.route("/")
def serve_ui():
    return send_from_directory(".", "admin.html")

if __name__ == "__main__":
    app.run(debug=False)