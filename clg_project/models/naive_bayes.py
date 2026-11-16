
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from utils.logger import logger


def train_naive_bayes(X_train, y_train, X_test):
    logger.info("Naive Bayes hyperparameter tuning started.")

    param_grid = {
        "alpha": [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
    }

    cv = StratifiedKFold(
        n_splits=3,
        shuffle=True,
        random_state=42
    )

    search = GridSearchCV(
        estimator=MultinomialNB(),
        param_grid=param_grid,
        scoring="accuracy",
        cv=cv,
        n_jobs=-1
    )

    search.fit(X_train, y_train)

    model = search.best_estimator_
    probability = model.predict_proba(X_test)[:, 1]

    logger.info(f"Best Naive Bayes alpha: {model.alpha}")
    logger.info(f"Best CV accuracy: {search.best_score_:.4f}")
    logger.info("Naive Bayes training completed.")

    return model, probability
