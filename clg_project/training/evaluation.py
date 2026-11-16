from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)
from utils.logger import logger


def evaluate_model(name, y_true, y_pred):
    return {
        "model": name,
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(
            y_true, y_pred, zero_division=0
        ),
        "recall": recall_score(
            y_true, y_pred, zero_division=0
        ),
        "f1_score": f1_score(
            y_true, y_pred, zero_division=0
        ),
    }


def evaluate_all_models(
    y_test,
    nb_prob,
    svm_prob,
    cnn_prob,
    stacking_pred,
):
    logger.info("Model evaluation started.")

    nb_pred = (nb_prob >= 0.5).astype(int)
    svm_pred = (svm_prob >= 0.5).astype(int)
    cnn_pred = (cnn_prob >= 0.5).astype(int)

    metrics = [
        evaluate_model("Naive Bayes", y_test, nb_pred),
        evaluate_model("SVM", y_test, svm_pred),
        evaluate_model("CNN", y_test, cnn_pred),
        evaluate_model(
            "Stacking Ensemble",
            y_test,
            stacking_pred,
        ),
    ]

    logger.info("Model evaluation completed.")

    return metrics


def select_best_model(metrics):
    best_model = max(
        metrics,
        key=lambda item: item["accuracy"],
    )

    logger.info(
        f"Best model selected: {best_model['model']} "
        f"with accuracy {best_model['accuracy']:.4f}"
    )

    return best_model["model"]