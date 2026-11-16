from fastapi import FastAPI, UploadFile, File, HTTPException
import time
import pandas as pd
from pydantic import BaseModel
from prediction.predict import predict_sentiment
from training.train_pipeline import train_pipeline
from utils.logger import logger
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AI-Based Sentiment Analysis "
)


@app.get("/")
def home():

    return {
        "message": "Sentiment Analysis API using FastAPI"
    }
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://sentiment-ensemble.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/upload-dataset")
async def upload_dataset(
    user_file: UploadFile = File(...)
):
    start_time = time.perf_counter()

    logger.info(
        f"Dataset upload received: {user_file.filename}"
    )

    # Check file type
    if not user_file.filename.lower().endswith(".csv"):

        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file"
        )

    # Read CSV
    try:

        df = pd.read_csv(
            user_file.file,
            encoding="latin-1"
        )

    except Exception as e:

        logger.error(
            f"CSV reading failed: {str(e)}"
        )

        raise HTTPException(
            status_code=400,
            detail="Unable to read CSV file."
        )

    # Normalize column names
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
    )

    # Check text/review column
    if (
        "text" not in df.columns
        and "review" not in df.columns
    ):

        raise HTTPException(
            status_code=400,
            detail="CSV must contain either 'text' or 'review' column."
        )

    # Check sentiment column
    if "sentiment" not in df.columns:

        raise HTTPException(
            status_code=400,
            detail="CSV must contain a 'sentiment' column."
        )

    # Run training pipeline
    try:
        result = train_pipeline(df)

        elapsed_seconds = time.perf_counter() - start_time
        elapsed_minutes = elapsed_seconds / 60

        logger.info(
            f"Total dataset processing and training time: "
            f"{elapsed_minutes:.2f} minutes "
            f"({elapsed_seconds:.2f} seconds)"
        )

    except Exception as e:
        logger.error(f"Training pipeline failed: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail=f"Training pipeline failed: {str(e)}"
        )

    logger.info("Dataset processing completed.")

    return {
        "status": "success",

        "message": "Dataset processed successfully.",

        "filename": user_file.filename,

        "rows": result["processed_rows"],
        "training_time_seconds": round(elapsed_seconds, 2),
        "training_time_minutes": round(elapsed_minutes, 2),

        "training_samples": len(
            result["X_train"]
        ),

        "testing_samples": len(
            result["X_test"]
        ),

        "models": [
            "Naive Bayes",
            "SVM",
            "CNN",
            "Stacking Ensemble"
        ],

        "metrics": result["metrics"]
    }
class PredictionRequest(BaseModel):
    text: str
@app.post("/predict")
async def predict(request: PredictionRequest):

    logger.info("Prediction request received.")

    if not request.text.strip():
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty."
        )

    try:
        result = predict_sentiment(request.text)

    except Exception as e:

        logger.error(
            f"Prediction failed: {str(e)}"
        )

        raise HTTPException(
            status_code=500,
            detail="Prediction failed."
        )

    return {
        "status": "success",
        "text": request.text,
        "sentiment": result["sentiment"],
        "probability": result["probability"],
        "model_used": result["model_used"],
        "model_probabilities": result.get("model_probabilities", {}),
    }