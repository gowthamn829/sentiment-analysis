import numpy as np
from sklearn.model_selection import StratifiedKFold
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences

from models.cnn import build_cnn_model
from utils.logger import logger


def select_rows(values, indices):
    if hasattr(values, "iloc"):
        return values.iloc[indices]
    return values[indices]


def create_oof_predictions(
    X_train_tfidf,
    X_train_text,
    y_train,
    nb_alpha,
    svm_c,
    cnn_config,
    max_words=20000,
    max_len=300,
    batch_size=80,
):
    logger.info("OOF prediction generation started.")

    skf = StratifiedKFold(
        n_splits=3,
        shuffle=True,
        random_state=42,
    )

    oof_nb = np.zeros(len(y_train))
    oof_svm = np.zeros(len(y_train))
    oof_cnn = np.zeros(len(y_train))

    for fold, (train_idx, val_idx) in enumerate(
        skf.split(X_train_tfidf, y_train),
        start=1,
    ):
        logger.info(f"Starting OOF fold {fold}.")

        X_tf_train = X_train_tfidf[train_idx]
        X_tf_val = X_train_tfidf[val_idx]

        y_fold_train = select_rows(y_train, train_idx)

        # Naive Bayes OOF probabilities.
        nb_model = MultinomialNB(alpha=nb_alpha)
        nb_model.fit(X_tf_train, y_fold_train)

        oof_nb[val_idx] = nb_model.predict_proba(
            X_tf_val
        )[:, 1]

        # SVM OOF probabilities.
        svm_base = LinearSVC(
            C=svm_c,
            max_iter=5000,
            random_state=42,
        )

        svm_model = CalibratedClassifierCV(
            estimator=svm_base,
            cv=3,
        )

        svm_model.fit(X_tf_train, y_fold_train)

        oof_svm[val_idx] = svm_model.predict_proba(
            X_tf_val
        )[:, 1]

        # Fit a separate tokenizer only on this fold's
        # training texts before generating CNN OOF predictions.
        fold_text_train = select_rows(
            X_train_text,
            train_idx,
        ).astype(str).tolist()

        fold_text_val = select_rows(
            X_train_text,
            val_idx,
        ).astype(str).tolist()

        tokenizer = Tokenizer(num_words=max_words)
        tokenizer.fit_on_texts(fold_text_train)

        X_cnn_train = pad_sequences(
            tokenizer.texts_to_sequences(fold_text_train),
            maxlen=max_len,
            padding="post",
            truncating="post",
        )

        X_cnn_val = pad_sequences(
            tokenizer.texts_to_sequences(fold_text_val),
            maxlen=max_len,
            padding="post",
            truncating="post",
        )

        cnn_model = build_cnn_model(
            max_words=max_words,
            max_len=max_len,
            embedding_dim=cnn_config["embedding_dim"],
            filters=cnn_config["filters"],
            dropout=cnn_config["dropout"],
        )

        cnn_model.fit(
            X_cnn_train,
            y_fold_train,
            epochs=cnn_config["epochs"],
            batch_size=batch_size,
            verbose=0,
        )

        oof_cnn[val_idx] = cnn_model.predict(
            X_cnn_val,
            verbose=0,
        ).ravel()

        logger.info(f"OOF fold {fold} completed.")

    meta_train = np.column_stack([
        oof_nb,
        oof_svm,
        oof_cnn,
    ])

    logger.info("OOF prediction generation completed.")

    return meta_train


def train_stacking(meta_train, y_train):
    logger.info("Stacking meta-model training started.")

    model = LogisticRegression(
        max_iter=1000,
        random_state=42,
    )

    model.fit(meta_train, y_train)

    logger.info("Stacking meta-model training completed.")

    return model


def predict_stacking(model, meta_test):
    logger.info("Stacking prediction started.")

    probability = model.predict_proba(meta_test)[:, 1]
    prediction = (probability >= 0.5).astype(int)

    logger.info("Stacking prediction completed.")

    return prediction, probability