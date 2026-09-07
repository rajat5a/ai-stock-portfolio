from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import yfinance as yf
from . import models, database, schemas
from pydantic import BaseModel

from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta

# Database tables auto-create
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="AI-Powered Stock Portfolio Tracker", version="1.0")

# CORS Middleware Setup 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Secret & Configuration
SECRET_KEY = "super-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Dependency to get current authenticated user (Defined FIRST so endpoints can use it)
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

class PortfolioSell(BaseModel):
    symbol: str
    quantity: float
    sell_price: float

class UserCreate(BaseModel):
    email: str
    password: str

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Stock Portfolio Tracker API!"}

# User Signup Endpoint
@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(database.get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}

# User Login Endpoint (Token generation)
@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/portfolio/", response_model=list[schemas.PortfolioResponse])
def get_portfolio(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    stocks = db.query(models.Portfolio).filter(models.Portfolio.user_id == current_user.id).all()
    portfolio_data = []

    for stock in stocks:
        current_price = stock.buy_price
        previous_close = stock.buy_price
        try:
            ticker = yf.Ticker(stock.symbol)
            hist = ticker.history(period="2d")
            if not hist.empty and 'Close' in hist:
                current_price = hist['Close'].iloc[-1]
                previous_close = hist['Close'].iloc[-2] if len(hist) >= 2 else current_price
        except Exception:
            pass

        total_investment = stock.quantity * stock.buy_price
        current_value = stock.quantity * current_price
        profit_loss = current_value - total_investment
        profit_loss_percentage = (profit_loss / total_investment) * 100 if total_investment > 0 else 0
        today_profit_loss = (current_price - previous_close) * stock.quantity
        today_profit_loss_percentage = ((current_price - previous_close) / previous_close) * 100 if previous_close > 0 else 0

        portfolio_data.append({
            "id": stock.id,
            "symbol": stock.symbol,
            "quantity": stock.quantity,
            "buy_price": stock.buy_price,
            "current_price": round(current_price, 2),
            "total_investment": round(total_investment, 2),
            "current_value": round(current_value, 2),
            "profit_loss": round(profit_loss, 2),
            "profit_loss_percentage": round(profit_loss_percentage, 2),
            "today_profit_loss": round(today_profit_loss, 2),
            "today_profit_loss_percentage": round(today_profit_loss_percentage, 2)
        })

    return portfolio_data

@app.post("/portfolio/", response_model=schemas.PortfolioResponse)
def add_stock(stock: schemas.PortfolioCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    
    # Clean the symbol: remove '$', trim spaces, and convert to uppercase
    symbol_clean = stock.symbol.strip().upper().replace("$", "")
    
    # Automatically append .NS if no dot exchange is provided
    if "." not in symbol_clean:
        symbol_upper = f"{symbol_clean}.NS"
    else:
        symbol_upper = symbol_clean

    try:
        ticker = yf.Ticker(symbol_upper)
        todays_data = ticker.history(period="2d")
        if todays_data.empty:
            raise HTTPException(status_code=400, detail="Invalid ticker symbol.")
        current_price = todays_data['Close'].iloc[-1]
        previous_close = todays_data['Close'].iloc[-2] if len(todays_data) >= 2 else current_price
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail="Invalid ticker symbol or network error.")

    existing_stock = db.query(models.Portfolio).filter(
        models.Portfolio.user_id == current_user.id,
        models.Portfolio.symbol == symbol_upper
    ).first()

    if existing_stock:
        total_old_cost = existing_stock.quantity * existing_stock.buy_price
        total_new_cost = stock.quantity * stock.buy_price
        new_total_quantity = existing_stock.quantity + stock.quantity
        new_avg_price = (total_old_cost + total_new_cost) / new_total_quantity

        existing_stock.quantity = new_total_quantity
        existing_stock.buy_price = round(new_avg_price, 2)
        db.commit()
        db.refresh(existing_stock)
        db_stock = existing_stock
    else:
        db_stock = models.Portfolio(
            user_id=current_user.id,
            symbol=symbol_upper,
            quantity=stock.quantity,
            buy_price=stock.buy_price
        )
        db.add(db_stock)
        db.commit()
        db.refresh(db_stock)

    total_investment = db_stock.quantity * db_stock.buy_price
    current_value = db_stock.quantity * current_price
    profit_loss = current_value - total_investment
    profit_loss_percentage = (profit_loss / total_investment) * 100 if total_investment > 0 else 0
    today_profit_loss = (current_price - previous_close) * db_stock.quantity
    today_profit_loss_percentage = ((current_price - previous_close) / previous_close) * 100 if previous_close > 0 else 0

    db_stock.current_price = round(current_price, 2)
    db_stock.total_investment = round(total_investment, 2)
    db_stock.current_value = round(current_value, 2)
    db_stock.profit_loss = round(profit_loss, 2)
    db_stock.profit_loss_percentage = round(profit_loss_percentage, 2)
    db_stock.today_profit_loss = round(today_profit_loss, 2)
    db_stock.today_profit_loss_percentage = round(today_profit_loss_percentage, 2)

    return db_stock

@app.post("/portfolio/sell", response_model=schemas.PortfolioResponse)
def sell_stock(sell_data: PortfolioSell, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    symbol_upper = sell_data.symbol.upper()
    existing_stock = db.query(models.Portfolio).filter(
        models.Portfolio.user_id == current_user.id,
        models.Portfolio.symbol == symbol_upper
    ).first()

    if not existing_stock:
        raise HTTPException(status_code=404, detail="Stock not found in your portfolio.")
    if sell_data.quantity > existing_stock.quantity:
        raise HTTPException(status_code=400, detail="Cannot sell more quantity than owned.")

    try:
        ticker = yf.Ticker(symbol_upper)
        todays_data = ticker.history(period="2d")
        current_price = todays_data['Close'].iloc[-1] if not todays_data.empty else existing_stock.buy_price
        previous_close = todays_data['Close'].iloc[-2] if len(todays_data) >= 2 else current_price
    except Exception:
        current_price = existing_stock.buy_price
        previous_close = current_price

    existing_stock.quantity -= sell_data.quantity

    if existing_stock.quantity == 0:
        db.delete(existing_stock)
        db.commit()
        return {
            "id": 0, "symbol": symbol_upper, "quantity": 0, "buy_price": 0,
            "current_price": 0, "total_investment": 0, "current_value": 0,
            "profit_loss": 0, "profit_loss_percentage": 0, "today_profit_loss": 0, "today_profit_loss_percentage": 0
        }

    db.commit()
    db.refresh(existing_stock)

    total_investment = existing_stock.quantity * existing_stock.buy_price
    current_value = existing_stock.quantity * current_price
    profit_loss = current_value - total_investment
    profit_loss_percentage = (profit_loss / total_investment) * 100 if total_investment > 0 else 0
    today_profit_loss = (current_price - previous_close) * existing_stock.quantity
    today_profit_loss_percentage = ((current_price - previous_close) / previous_close) * 100 if previous_close > 0 else 0

    existing_stock.current_price = round(current_price, 2)
    existing_stock.total_investment = round(total_investment, 2)
    existing_stock.current_value = round(current_value, 2)
    existing_stock.profit_loss = round(profit_loss, 2)
    existing_stock.profit_loss_percentage = round(profit_loss_percentage, 2)
    existing_stock.today_profit_loss = round(today_profit_loss, 2)
    existing_stock.today_profit_loss_percentage = round(today_profit_loss_percentage, 2)

    return existing_stock

@app.delete("/portfolio/{stock_id}")
def delete_stock(stock_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    stock = db.query(models.Portfolio).filter(
        models.Portfolio.id == stock_id,
        models.Portfolio.user_id == current_user.id
    ).first()
    
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found in portfolio")
    
    db.delete(stock)
    db.commit()
    return {"message": "Stock deleted successfully", "stock_id": stock_id}