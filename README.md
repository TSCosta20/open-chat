# open_chat

A production-ready ChatGPT-like PWA with streaming AI responses, built on Next.js 15 + FastAPI + Gemma.

---

## Project Structure

```
open_chat/
├── frontend/    # Next.js 15 App Router + Tailwind CSS + Zustand
└── backend/     # FastAPI + SQLAlchemy + HuggingFace Gemma
```

---

## Setup & Run Locally

### Prerequisites

- Node.js 20+
- Python 3.11+
- A [HuggingFace account](https://huggingface.co) with an API token

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set your HF_API_TOKEN

# Start the server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local if your backend runs on a different port

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chats` | List all chats |
| POST | `/chats` | Create a new chat |
| PATCH | `/chats/{id}` | Rename a chat |
| DELETE | `/chats/{id}` | Delete a chat + messages |
| GET | `/messages/{chat_id}` | Get messages for a chat |
| POST | `/chat` | Send message & stream response (SSE) |
| GET | `/models` | List available AI models |
| GET | `/health` | Health check |

---

## How to Add a New AI Model

1. **Create a model class** in `backend/app/ai/`:

```python
# backend/app/ai/mistral.py
from app.ai.base import BaseAIModel

class MistralModel(BaseAIModel):
    def __init__(self):
        self._model_id = "mistral-7b-it"

    @property
    def model_id(self) -> str:
        return self._model_id

    async def stream(self, messages: list):
        # Implement your streaming logic here
        ...
```

2. **Register it** in `backend/app/ai/router.py`:

```python
from app.ai.mistral import MistralModel

SUPPORTED_MODELS = {
    "gemma-7b-it": GemmaModel("google/gemma-7b-it", "gemma-7b-it"),
    "gemma-2b-it": GemmaModel("google/gemma-2b-it", "gemma-2b-it"),
    "mistral-7b-it": MistralModel(),   # ← add this
}
```

3. **Add to frontend types** in `frontend/src/types/index.ts`:

```ts
export type ModelId = "gemma-7b-it" | "gemma-2b-it" | "mistral-7b-it";

export const AVAILABLE_MODELS = [
  { id: "gemma-2b-it", name: "Gemma 2B" },
  { id: "gemma-7b-it", name: "Gemma 7B" },
  { id: "mistral-7b-it", name: "Mistral 7B" },  // ← add this
];
```

---

## PWA Install

- Open the app in Chrome/Edge
- Click the install button in the address bar (or browser menu)
- The app installs as a standalone window

To test offline: DevTools → Network → select "Offline" — the UI loads from cache; chat input is disabled.

---

## Database Migration to PostgreSQL

Only one change needed in `backend/.env`:

```env
# SQLite (default)
DATABASE_URL=sqlite:///./data/chat.db

# PostgreSQL
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/open_chat
```

No code changes required. Run `alembic` for production migrations:

```bash
cd backend
alembic init alembic
# Edit alembic/env.py to import Base from app.database
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

---

## Deployment

### Backend (e.g. Railway, Render, Fly.io)

```bash
# Production start command
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set environment variables:
- `HF_API_TOKEN`
- `DATABASE_URL` (PostgreSQL recommended for production)
- `CORS_ORIGINS` (your frontend domain)

### Frontend (Vercel)

```bash
cd frontend
vercel deploy
```

Set environment variable:
- `NEXT_PUBLIC_API_URL` = your deployed backend URL
