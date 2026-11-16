
from tensorflow.keras.layers import (
    Input,
    Embedding,
    Conv1D,
    GlobalMaxPooling1D,
    Dense,
    Dropout,
)
from tensorflow.keras.models import Sequential
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences

from utils.logger import logger


def build_cnn_model(
    max_words=20000,
    max_len=300,
    embedding_dim=64,
    filters=32,
    dropout=0.3,
):
    model = Sequential([
        Input(shape=(max_len,)),
        Embedding(
            input_dim=max_words,
            output_dim=embedding_dim,
        ),
        Conv1D(
            filters=filters,
            kernel_size=3,
            activation="relu",
        ),
        GlobalMaxPooling1D(),
        Dropout(dropout),
        Dense(16, activation="relu"),
        Dropout(dropout),
        Dense(1, activation="sigmoid"),
    ])

    model.compile(
        optimizer="adam",
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )

    return model


def train_cnn(
    X_train,
    y_train,
    X_test,
    max_words=20000,
    max_len=300,
    max_epochs=3,
    batch_size=80,
):
    logger.info("CNN preprocessing started.")

    tokenizer = Tokenizer(num_words=max_words)
    tokenizer.fit_on_texts(X_train)

    X_train_seq = tokenizer.texts_to_sequences(X_train)
    X_test_seq = tokenizer.texts_to_sequences(X_test)

    X_train_pad = pad_sequences(
        X_train_seq,
        maxlen=max_len,
        padding="post",
        truncating="post",
    )

    X_test_pad = pad_sequences(
        X_test_seq,
        maxlen=max_len,
        padding="post",
        truncating="post",
    )

    logger.info("CNN preprocessing completed.")

    # Fixed lightweight configuration; no search loop.
    cnn_config = {
        "embedding_dim": 64,
        "filters": 32,
        "dropout": 0.3,
        "epochs": max_epochs,
    }

    logger.info("CNN training started with fixed configuration.")

    cnn_model = build_cnn_model(
        max_words=max_words,
        max_len=max_len,
        embedding_dim=cnn_config["embedding_dim"],
        filters=cnn_config["filters"],
        dropout=cnn_config["dropout"],
    )

    cnn_model.fit(
        X_train_pad,
        y_train,
        epochs=max_epochs,
        batch_size=batch_size,
        verbose=0,
    )

    logger.info(
        f"CNN training completed in {max_epochs} epochs."
    )

    cnn_prob = cnn_model.predict(
        X_test_pad,
        verbose=0,
    ).ravel()

    logger.info("CNN test prediction completed.")

    return (
        cnn_model,
        tokenizer,
        X_train_pad,
        X_test_pad,
        cnn_prob,
        cnn_config,
    )
