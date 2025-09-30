from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import numpy as np

app = FastAPI()

# Add CORS middleware to allow requests from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.get("/")
def root():
    return {"msg": "NeoCare Backend is running successfully!"}

@app.post("/process_ppg/")
async def process_ppg(file: UploadFile = None):
    # Example: simulate heart rate calculation
    signal = np.random.randn(1000)  # mock signal
    heart_rate = 60 + int(np.std(signal) * 10)
    return {"heart_rate": heart_rate, "status": "processed"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)