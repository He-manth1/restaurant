# Restaurant website (Aurum Table)

Single-page frontend (HTML, CSS, vanilla JavaScript) and a Flask + MongoDB backend.

## What you need installed

- **Python 3.10+** (check with `python --version`)
- **MongoDB** — either:
  - **MongoDB Atlas** (cloud), or  
  - **MongoDB Community** running locally on `mongodb://localhost:27017`

---

## 1. Clone or open the project

```powershell
cd C:\Users\akash\Desktop\Restaurant-website
```

(Use your actual folder path if different.)

---

## 2. Backend — install dependencies

```powershell
cd backend
python -m pip install -r requirements.txt
```

(Optional) use a virtual environment first:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

---

## 3. Backend — configure MongoDB

1. Copy the example env file and edit it:

```powershell
cd backend
copy .env.example .env
```

2. Open `backend\.env` in an editor and set **`MONGO_URI`**:

   - **Atlas** (recommended): paste your connection string, including the database name in the path, for example:
     - `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/YOUR_DB_NAME?appName=YourApp`
   - **Local MongoDB**:
     - `MONGO_URI=mongodb://localhost:27017/restaurant_db`

3. **Atlas only:** In the Atlas UI, add your IP to **Network Access** (or `0.0.0.0/0` for testing only).

---

## 4. Run the backend (Flask)

From the `backend` folder:

```powershell
cd C:\Users\akash\Desktop\Restaurant-website\backend
python app.py
```

The API should be at **http://127.0.0.1:5000** (or **http://localhost:5000**).

Quick checks in a browser or terminal:

- Health: [http://127.0.0.1:5000/health](http://127.0.0.1:5000/health)
- Reviews: [http://127.0.0.1:5000/reviews](http://127.0.0.1:5000/reviews)

Leave this terminal window **open** while you use the site.

---

## 5. Open the frontend

You can do either of the following.

### Option A — Open the HTML file directly

Double-click `frontend\index.html` or open it in the browser.  
The script is set to call the API at **http://localhost:5000** when needed.

### Option B — Use a local static server (e.g. Live Server in VS Code)

Serve the `frontend` folder (often port **5500**). The frontend is configured to still talk to **http://localhost:5000** for API calls.

**Important:** The backend (`python app.py`) must be running for menu orders and reviews to work.

---

## 6. Production-style run (optional)

From `backend` (after installing requirements):

```powershell
cd C:\Users\akash\Desktop\Restaurant-website\backend
gunicorn -w 1 -b 0.0.0.0:5000 app:app
```

(Use a proper host/reverse proxy in real production.)

---

## Project layout

```
Restaurant-website/
  frontend/
    index.html
    style.css
    script.js
  backend/
    app.py
    requirements.txt
    .env.example      ← copy to .env and add MONGO_URI
    .env              ← create this file (do not commit secrets)
```

---

## Troubleshooting

| Problem | What to try |
|--------|-------------|
| `Failed to load reviews` / 404 on port 5500 | Start Flask on port 5000 and refresh; ensure `script.js` points API to `http://localhost:5000`. |
| Mongo connection errors | Check `MONGO_URI` in `backend\.env`, Atlas IP allowlist, and that MongoDB is running (if local). |
| `ModuleNotFoundError` | Run `python -m pip install -r requirements.txt` inside `backend`. |

---

## Security note

Never commit **`backend\.env`** or paste real database passwords in public repos. Keep secrets only in `.env` on your machine.
