
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from utils.logger import logger


def train_svm(X_train, y_train, X_test):
    logger.info("SVM hyperparameter tuning started.")

    cv = StratifiedKFold(
        n_splits=3,
        shuffle=True,
        random_state=42
    )

    calibrated_svm = CalibratedClassifierCV(
        estimator=LinearSVC(
            max_iter=5000,
            random_state=42
        ),
        cv=3
    )

    param_grid = {
        "estimator__C": [0.01, 0.1, 1.0, 10.0]
    }

    search = GridSearchCV(
        estimator=calibrated_svm,
        param_grid=param_grid,
        scoring="accuracy",
        cv=cv,
        n_jobs=-1
    )

    search.fit(X_train, y_train)

    model = search.best_estimator_
    probability = model.predict_proba(X_test)[:, 1]

    logger.info(
        f"Best SVM C: {search.best_params_['estimator__C']}"
    )
    logger.info(
        f"Best SVM CV accuracy: {search.best_score_:.4f}"
    )
    logger.info("SVM training completed.")

    return model, probability
