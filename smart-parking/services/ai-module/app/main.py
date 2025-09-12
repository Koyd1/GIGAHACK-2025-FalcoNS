from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ai-module")


class RecommendInput(BaseModel):
    zoneId: int


@app.get("/")
def root():
    return {"name": "ai-module"}


@app.post("/recommend")
def recommend(body: RecommendInput):
    price_multiplier = 1.0 + (body.zoneId % 3) * 0.1
    return {"zoneId": body.zoneId, "multiplier": price_multiplier}
