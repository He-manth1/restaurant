"""
Aurum Table — Flask backend (MongoDB only via PyMongo).
Endpoints:
  - POST /order
  - POST /reviews
  - GET /reviews

Mongo config:
  - Reads MONGO_URI from .env (python-dotenv)
  - Default MONGO_URI: mongodb://localhost:27017
  - DB name: uses URI default database if present (recommended),
    otherwise falls back to restaurant_db
"""

from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ConfigurationError

BASE_DIR = Path(__file__).resolve().parent
# Repo layout: ../frontend (sibling of backend/) — served in production so one URL hosts site + API.
FRONTEND_DIR = (BASE_DIR.parent / "frontend").resolve()
load_dotenv(BASE_DIR / ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
FALLBACK_DB_NAME = "restaurant_db"

# Collections (kept distinct in shared DBs like portfolioDB)
ORDERS_COLLECTION = "restaurant_orders"
REVIEWS_COLLECTION = "restaurant_reviews"

app = Flask(__name__)
CORS(app)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def error(message: str, status_code: int = 400):
    return jsonify({"error": message}), status_code


def to_int(value):
    try:
        return int(value)
    except Exception:
        return None


try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=4000)

    # If your URI includes a database path (e.g. ...mongodb.net/portfolioDB),
    # PyMongo exposes it as the "default database".
    try:
        db = mongo_client.get_default_database()
    except ConfigurationError:
        db = None

    if db is None:
        db = mongo_client[FALLBACK_DB_NAME]

    orders_col = db[ORDERS_COLLECTION]
    reviews_col = db[REVIEWS_COLLECTION]
except Exception as e:
    mongo_client = None
    db = None
    orders_col = None
    reviews_col = None
    app.logger.exception("Failed to initialize MongoDB: %s", e)


@app.get("/")
def root():
    """Serve the marketing site at `/` when `frontend/` exists (e.g. Render single service)."""
    index = FRONTEND_DIR / "index.html"
    if index.is_file():
        return send_from_directory(FRONTEND_DIR, "index.html")
    return jsonify(
        {
            "service": "Aurum Table API",
            "docs": "Use GET /health, GET /reviews, POST /order, POST /reviews",
        }
    ), 200


@app.get("/style.css")
def serve_style():
    path = FRONTEND_DIR / "style.css"
    if not path.is_file():
        return error("Not found.", 404)
    return send_from_directory(FRONTEND_DIR, "style.css")


@app.get("/script.js")
def serve_script():
    path = FRONTEND_DIR / "script.js"
    if not path.is_file():
        return error("Not found.", 404)
    return send_from_directory(FRONTEND_DIR, "script.js")


@app.get("/health")
def health():
    """Simple health check."""
    try:
        if mongo_client is None:
            return jsonify({"status": "ok", "mongo": "not_configured"}), 200
        mongo_client.admin.command("ping")
        return jsonify({"status": "ok", "mongo": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "degraded", "mongo": "error", "error": str(e)}), 200


@app.post("/order")
def place_order():
    """
    Body: { name, phone, items: [{name, price, qty}], total }
    Saves into MongoDB collection: orders (adds timestamp)
    """
    try:
        if orders_col is None:
            return error("Database not available. Check MONGO_URI and MongoDB server.", 500)

        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").strip()
        items = data.get("items")
        total = data.get("total")

        if not name or not phone or not items:
            return error("Missing required fields: name, phone, items", 400)
        if not isinstance(items, list) or len(items) == 0:
            return error("Items must be a non-empty list.", 400)

        normalized_items = []
        for it in items:
            if not isinstance(it, dict):
                return error("Each item must be an object with name, price, qty.", 400)

            item_name = (it.get("name") or "").strip()
            price = it.get("price")
            qty = it.get("qty")

            qty_int = to_int(qty)
            try:
                price_num = float(price)
            except Exception:
                price_num = None

            if not item_name or qty_int is None or qty_int < 1 or price_num is None or price_num < 0:
                return error("Invalid item fields. Expected {name, price>=0, qty>=1}.", 400)

            normalized_items.append({"name": item_name, "price": price_num, "qty": qty_int})

        computed_total = round(sum(it["price"] * it["qty"] for it in normalized_items), 2)
        try:
            client_total = float(total)
        except Exception:
            client_total = computed_total

        doc = {
            "name": name,
            "phone": phone,
            "items": normalized_items,
            "total": float(round(client_total, 2)),
            "computed_total": float(computed_total),
            "created_at": utc_now(),
        }

        orders_col.insert_one(doc)
        return jsonify({"message": "Order placed successfully!"}), 200
    except Exception as e:
        app.logger.exception("POST /order failed: %s", e)
        return error("Server error placing order.", 500)


@app.post("/reviews")
def submit_review():
    """
    Body: { name, rating, comment }
    Validates fields, rating must be int 1-5
    Saves into MongoDB collection: reviews (adds timestamp)
    """
    try:
        if reviews_col is None:
            return error("Database not available. Check MONGO_URI and MongoDB server.", 500)

        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        rating_raw = data.get("rating")
        comment = (data.get("comment") or "").strip()

        rating = to_int(rating_raw)

        if not name or rating is None or not comment:
            return error("Missing required fields: name, rating, comment", 400)
        if rating < 1 or rating > 5:
            return error("Rating must be an integer from 1 to 5.", 400)

        doc = {"name": name, "rating": rating, "comment": comment, "created_at": utc_now()}
        result = reviews_col.insert_one(doc)

        review = {
            "id": str(result.inserted_id),
            "name": name,
            "rating": rating,
            "comment": comment,
            "created_at": iso(doc["created_at"]),
        }

        return jsonify({"message": "Review submitted!", "review": review}), 200
    except Exception as e:
        app.logger.exception("POST /reviews failed: %s", e)
        return error("Server error submitting review.", 500)


@app.get("/reviews")
def get_reviews():
    """Return all reviews sorted by newest first."""
    try:
        if reviews_col is None:
            return error("Database not available. Check MONGO_URI and MongoDB server.", 500)

        docs = list(reviews_col.find({}, sort=[("created_at", -1)]))
        reviews = []
        for d in docs:
            created_at = d.get("created_at")
            created_at_str = iso(created_at) if isinstance(created_at, datetime) else ""
            reviews.append(
                {
                    "id": str(d.get("_id")),
                    "name": d.get("name", ""),
                    "rating": int(d.get("rating", 5)),
                    "comment": d.get("comment", ""),
                    "created_at": created_at_str,
                }
            )

        return jsonify({"reviews": reviews}), 200
    except Exception as e:
        app.logger.exception("GET /reviews failed: %s", e)
        return error("Server error loading reviews.", 500)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)