import os
import joblib
from utils.logger import logger


def save_models(result):
    os.makedirs("saved_models", exist_ok=True)

    logger.info("Saving trained models.")

    joblib.dump(
        result["tfidf"],
        "saved_models/tfidf.pkl",
    )
    joblib.dump(
        result["nb_model"],
        "saved_models/naive_bayes.pkl",
    )
    joblib.dump(
        result["svm_model"],
        "saved_models/svm.pkl",
    )
    joblib.dump(
        result["tokenizer"],
        "saved_models/tokenizer.pkl",
    )
    joblib.dump(
        result["stacking_model"],
        "saved_models/stacking.pkl",
    )
    joblib.dump(
        result["best_model"],
        "saved_models/best_model.pkl",
    )
    joblib.dump(
        result["cnn_config"],
        "saved_models/cnn_config.pkl",
    )

    result["cnn_model"].save("saved_models/cnn.keras")

    logger.info("All trained models saved successfully.")