from pydantic import BaseModel
from datetime import datetime

class PortfolioCreate(BaseModel):
    symbol: str
    quantity: float
    buy_price: float

class PortfolioResponse(PortfolioCreate):
    id: int
    current_price: float
    total_investment: float
    current_value: float
    profit_loss: float
    profit_loss_percentage: float
    today_profit_loss: float 
    today_profit_loss_percentage: float

    class Config:
        from_attributes = True