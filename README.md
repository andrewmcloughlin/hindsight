# Hindsight

Hindsight is a dead simple retrospective app. Users enter a name to create an account and all team members enter the same team name to enter a retrospective. Users can add retrospective items to a Start, Stop, Continue board.

There is no authentication.

## Architecture & Tech Stack

- **Frontend:** React, Vite, and Tailwind CSS
- **Backend:** Django, Django REST Framework, and Django Channels
- **Database:** SQLite

## Project Structure

```
hindsight/
├── frontend/         # React & Vite frontend application
├── hindsight/        # Django backend project and apps (retros)
├── venv/             # Python virtual environment
└── Makefile          # Consolidated orchestration commands
```

# Prerequisites

- Python (3.10+)
- Node.js & npm

# Setup

`make install`

# Running in Dev

`make dev`
