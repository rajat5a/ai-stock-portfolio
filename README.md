# AI-Powered Stock Portfolio Tracker

A full-stack, secure multi-user stock portfolio tracking application built with FastAPI, React, SQLite, and Tailwind CSS. It fetches live market data using Yahoo Finance and calculates real-time profit, loss, and portfolio valuations.

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite, yfinance, JWT Authentication, Passlib (Bcrypt)
- **Frontend:** React, Tailwind CSS, Axios
- **Containerization:** Docker & Docker Compose

## Features

- **Secure Authentication:** User Signup and Login with JWT tokens and encrypted password hashing. Each user can only view and manage their own portfolio.
- **Live Market Tracking:** Automatically fetches real-time stock prices and previous close data using Yahoo Finance (`yfinance`).
- **Smart Stock Management:** Add stocks using ticker symbols (auto-appends `.NS` for Indian NSE stocks). If you add the same stock multiple times, it automatically calculates the new average buy price.
- **Partial & Full Selling:** Sell any quantity of your holdings at a custom or market price, with instant recalculation of remaining investment and P&L.
- **Responsive Dashboard:** Summary cards showing Total Investment, Current Value, Total Profit/Loss, and Today's Profit/Loss.

## Project Structure

ai-stock-portfolio/
│
├── app/                  # FastAPI Backend
│   ├── database.py       # DB connection setup
│   ├── models.py         # SQLAlchemy models (User, Portfolio)
│   ├── schemas.py        # Pydantic validation schemas
│   └── main.py           # API endpoints & JWT logic
│
├── portfolio-frontend/   # React Frontend
│   ├── src/
│   │   ├── services/api.js # Axios API calls with interceptors
│   │   └── App.js        # Main UI components & Dashboard logic
│   └── package.json
│
├── Dockerfile            # Backend Dockerfile
├── portfolio-frontend/Dockerfile # Frontend Dockerfile
├── docker-compose.yml    # Docker orchestration file
└── requirements.txt      # Python dependencies