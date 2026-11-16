import joblib

from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences
from pathlib import Path
from preprocessing.text_preprocessing import clean_text
from utils.logger import logger


BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "saved_models"

def predict_sentiment(text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text must not be empty.")

    logger.info("Sentiment prediction started.")
    tfidf = joblib.load(MODEL_DIR / "tfidf.pkl")
    nb_model = joblib.load(MODEL_DIR / "naive_bayes.pkl")
    svm_model = joblib.load(MODEL_DIR / "svm.pkl")
    tokenizer = joblib.load(MODEL_DIR / "tokenizer.pkl")
    stacking_model = joblib.load(MODEL_DIR / "stacking.pkl")
    best_model = joblib.load(MODEL_DIR / "best_model.pkl")
    cnn_model = load_model(MODEL_DIR / "cnn.keras")

    cleaned_text = clean_text(text)

    # Naive Bayes and SVM probabilities.
    text_tfidf = tfidf.transform([cleaned_text])

    nb_prob = float(
        nb_model.predict_proba(text_tfidf)[0, 1]
    )

    svm_prob = float(
        svm_model.predict_proba(text_tfidf)[0, 1]
    )

    # CNN probability.
    text_sequence = tokenizer.texts_to_sequences(
        [cleaned_text]
    )

    text_pad = pad_sequences(
        text_sequence,
        maxlen=300,
        padding="post",
        truncating="post",
    )

    cnn_prob = float(
        cnn_model.predict(text_pad, verbose=0).ravel()[0]
    )

    # Keep the meta-model input order consistent:
    # Naive Bayes, SVM, CNN.
    meta_input = [[nb_prob, svm_prob, cnn_prob]]

    stacking_prob = float(
        stacking_model.predict_proba(meta_input)[0, 1]
    )

    model_probabilities = {
        "Naive Bayes": nb_prob,
        "SVM": svm_prob,
        "CNN": cnn_prob,
        "Stacking Ensemble": stacking_prob,
    }

    if best_model not in model_probabilities:
        raise ValueError(
            f"Unsupported saved best model: {best_model}"
        )

    probability = model_probabilities[best_model]
    sentiment = "positive" if probability >= 0.5 else "negative"

    logger.info(
        f"Prediction completed using {best_model}."
    )

    return {
        "sentiment": sentiment,
        "probability": probability,
        "model_used": best_model,
        "model_probabilities": model_probabilities,
    }