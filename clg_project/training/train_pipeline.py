import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer

from preprocessing.text_preprocessing import clean_text
from models.naive_bayes import train_naive_bayes
from models.svm import train_svm
from models.cnn import train_cnn
from models.stacking import (
    create_oof_predictions,
    train_stacking,
    predict_stacking,
)
from training.evaluation import (
    evaluate_all_models,
    select_best_model,
)
from training.model_saver import save_models
from utils.logger import logger


def train_pipeline(df):
    logger.info("Training pipeline started.")

    df = df.copy()
    df.columns = df.columns.str.strip().str.lower()

    if "review" in df.columns and "text" not in df.columns:
        df = df.rename(columns={"review": "text"})

    if "text" not in df.columns or "sentiment" not in df.columns:
        raise ValueError(
            "Dataset must contain text/review and sentiment columns."
        )

    df = df.dropna(subset=["text", "sentiment"])

    df["sentiment"] = (
        df["sentiment"].astype(str).str.strip().str.lower()
    )

    df = df[df["sentiment"] != "neutral"].copy()

    df["sentiment"] = df["sentiment"].replace({
        "negative": 0,
        "positive": 1,
    })

    df["sentiment"] = df["sentiment"].astype(int)
    df["text"] = df["text"].apply(clean_text)

    logger.info("Preprocessing completed.")

    X = df["text"]
    y = df["sentiment"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    logger.info("Train/test split completed.")

    tfidf = TfidfVectorizer(max_features=10000)

    X_train_tfidf = tfidf.fit_transform(X_train)
    X_test_tfidf = tfidf.transform(X_test)

    logger.info("TF-IDF transformation completed.")

    # Train and tune the traditional ML models.
    nb_model, nb_prob = train_naive_bayes(
        X_train_tfidf,
        y_train,
        X_test_tfidf,
    )

    svm_model, svm_prob = train_svm(
        X_train_tfidf,
        y_train,
        X_test_tfidf,
    )

    svm_c = svm_model.estimator.C

    logger.info("Naive Bayes and SVM completed.")

    # Train and tune the lightweight CNN.
    (
        cnn_model,
        tokenizer,
        X_train_pad,
        X_test_pad,
        cnn_prob,
        cnn_config,
    ) = train_cnn(
        X_train,
        y_train,
        X_test,
        max_words=20000,
        max_len=300,
        max_epochs=3,
        batch_size=80,
    )

    logger.info("CNN training completed.")

    # Generate OOF training features for the meta-classifier.
    meta_train = create_oof_predictions(
        X_train_tfidf,
        X_train,
        y_train,
        nb_alpha=nb_model.alpha,
        svm_c=svm_c,
        cnn_config=cnn_config,
        max_words=20000,
        max_len=300,
        batch_size=80,
    )

    # Each column must stay in the same model order as meta_train.
    meta_test = np.column_stack([
        nb_prob,
        svm_prob,
        cnn_prob,
    ])

    logger.info("Stacking features generated.")

    stacking_model = train_stacking(meta_train, y_train)

    stacking_pred, stacking_prob = predict_stacking(
        stacking_model,
        meta_test,
    )

    logger.info("Stacking ensemble completed.")

    metrics = evaluate_all_models(
        y_test,
        nb_prob,
        svm_prob,
        cnn_prob,
        stacking_pred,
    )

    best_model = select_best_model(metrics)

    save_models({
        "tfidf": tfidf,
        "nb_model": nb_model,
        "svm_model": svm_model,
        "cnn_model": cnn_model,
        "cnn_config": cnn_config,
        "tokenizer": tokenizer,
        "stacking_model": stacking_model,
        "best_model": best_model,
    })

    logger.info("Training pipeline completed.")

    return {
        "X_train": X_train,
        "X_test": X_test,
        "y_train": y_train,
        "y_test": y_test,
        "X_train_tfidf": X_train_tfidf,
        "X_test_tfidf": X_test_tfidf,
        "tfidf": tfidf,
        "nb_model": nb_model,
        "nb_prob": nb_prob,
        "svm_model": svm_model,
        "svm_prob": svm_prob,
        "cnn_model": cnn_model,
        "cnn_prob": cnn_prob,
        "cnn_config": cnn_config,
        "tokenizer": tokenizer,
        "X_train_pad": X_train_pad,
        "X_test_pad": X_test_pad,
        "meta_train": meta_train,
        "meta_test": meta_test,
        "stacking_model": stacking_model,
        "stacking_pred": stacking_pred,
        "stacking_prob": stacking_prob,
        "best_model": best_model,
        "metrics": metrics,
        "processed_rows": len(df),
    }