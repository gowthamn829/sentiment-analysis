

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { logger } from "../services/logger";
import { predictSentiment } from "../services/api";
import { useDataset } from "../context/DatasetContext";

const MODEL_NAMES = [
  "Naive Bayes",
  "SVM",
  "CNN",
  "Stacking Ensemble",
];

function Analyze() {
  const {
  analyzeText: text,
  setAnalyzeText: setText,

  analyzeResult: result,
  setAnalyzeResult: setResult,

  analyzeLoading: loading,
  setAnalyzeLoading: setLoading,

  analyzeError: error,
  setAnalyzeError: setError,
} = useDataset();

  async function handleAnalyze(event) {
    event.preventDefault();

    const review = text.trim();

    logger.info("Analyze action triggered", {
      textLength: review.length,
    });

    if (!review) {
      setError("Enter a review before analyzing.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      logger.info("Sending review to prediction API");

      const response = await predictSentiment(review);

      logger.info(
        "Complete prediction API response:\n" +
          JSON.stringify(response, null, 2)
      );

      setResult(response);

      if (!response?.model_probabilities) {
        logger.warn("API response is missing model probabilities");
      }
    } catch (err) {
      logger.error("Sentiment prediction failed", {
        message: err.message,
        status: err.response?.status,
        detail: err.response?.data?.detail,
      });

      setError(
        err.response?.data?.detail ||
          "Could not connect to the backend. Check that FastAPI is running."
      );
    } finally {
      setLoading(false);
      logger.info("Prediction request finished");
    }
  }

  function clearAnalysis() {
    setText("");
    setResult(null);
    setError("");
  }

  const probabilities = MODEL_NAMES.map((name) => {
    const rawValue = result?.model_probabilities?.[name];
    const value =
      rawValue === undefined || rawValue === null
        ? null
        : Number(rawValue);

    return {
      name,
      probability:
        value !== null && Number.isFinite(value)
          ? Math.max(0, Math.min(1, value))
          : null,
    };
  });

  const hasProbabilities = probabilities.every(
    (model) => model.probability !== null
  );

  const selectedModel = result?.model_used;
  const selectedProbability = Number(result?.probability ?? 0);

  const sentiment =
    result?.sentiment?.toLowerCase() ||
    (selectedProbability >= 0.5 ? "positive" : "negative");

  const confidence =
    sentiment === "positive"
      ? selectedProbability
      : 1 - selectedProbability;

  const getVote = (probability) =>
    probability >= 0.5 ? "positive" : "negative";

  const positiveVotes = probabilities.filter(
    (model) =>
      model.probability !== null && model.probability >= 0.5
  ).length;

  const negativeVotes = probabilities.filter(
    (model) =>
      model.probability !== null && model.probability < 0.5
  ).length;

  const hasDisagreement =
    hasProbabilities &&
    positiveVotes > 0 &&
    negativeVotes > 0;

  const majoritySentiment =
    positiveVotes > negativeVotes
      ? "positive"
      : negativeVotes > positiveVotes
        ? "negative"
        : null;

  const selectedModelProbability = probabilities.find(
    (model) => model.name === selectedModel
  )?.probability;

  const selectedVote =
    selectedModelProbability === null ||
    selectedModelProbability === undefined
      ? sentiment
      : getVote(selectedModelProbability);

  const selectedDisagrees =
    majoritySentiment !== null &&
    selectedVote !== majoritySentiment;

  return (
    <div className="analyze-page">
      <div className="analyze-intro">
        <div>
          <h2>Explore a review</h2>
          <p>
            Compare how different machine learning models interpret
            the same text.
          </p>
        </div>

        <span className="model-count">
          <Sparkles size={15} />
          4 models
        </span>
      </div>

      <div className="analyze-grid">
        {/* TOP LEFT: Review input */}
        <section className="panel input-panel">
          <div className="panel-heading">
            <div className="section-icon">
              <MessageSquareText size={19} />
            </div>

            <div>
              <h3>Review text</h3>
              <p>Paste or type a movie review</p>
            </div>
          </div>

          <form onSubmit={handleAnalyze}>
            <textarea
              className="review-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Example: The story was engaging, the acting was excellent, and I really enjoyed this movie..."
              rows={5}
              maxLength={5000}
              disabled={loading}
            />

            <div className="input-footer">
              <span>{text.length}/5000 characters</span>

              <button
                type="button"
                className="clear-button"
                disabled={!text || loading}
                onClick={clearAnalysis}
              >
                Clear
              </button>
            </div>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={loading || !text.trim()}
            >
              {loading ? (
                <>
                  <LoaderCircle
                    className="spin-icon"
                    size={17}
                  />
                  Analyzing review...
                </>
              ) : (
                <>
                  <Sparkles size={17} />
                  Analyze sentiment
                </>
              )}
            </button>
          </form>

          <div className="input-note">
            <span className="note-dot" />
            Compare predictions from all four models.
          </div>
        </section>

        {/* TOP RIGHT: Prediction result */}
        <section className="panel result-panel">
          <div className="panel-heading">
            <div className="section-icon">
              <Sparkles size={19} />
            </div>

            <div>
              <h3>Prediction result</h3>
              <p>
                {result
                  ? "Based on the selected best-performing model"
                  : "Your analysis will appear here"}
              </p>
            </div>
          </div>

          {!result && !loading && (
            <div className="empty-result">
              <div className="empty-result-icon">
                <MessageSquareText size={25} />
              </div>

              <h3>Ready to analyze</h3>
              <p>
                Enter a review to see its sentiment and compare
                predictions from all four models.
              </p>
            </div>
          )}

          {loading && (
            <div className="empty-result">
              <LoaderCircle
                size={28}
                className="spin-icon loading-icon"
              />
              <h3>Analyzing your review</h3>
              <p>Waiting for the prediction from FastAPI.</p>
            </div>
          )}

          {result && (
            <>
              <div
                className={`verdict-card ${
                  sentiment === "positive"
                    ? "verdict-positive"
                    : "verdict-negative"
                }`}
              >
                <div className="verdict-main">
                  <span className="verdict-label">
                    {sentiment === "positive"
                      ? "Positive sentiment"
                      : "Negative sentiment"}
                  </span>

                  <span className="verdict-model">
                    Selected model: {selectedModel || "Unknown"}
                  </span>
                </div>

                <div className="confidence-value">
                  <span>Class confidence</span>
                  <strong>
                    {(
                      Math.max(0, Math.min(1, confidence)) * 100
                    ).toFixed(1)}%
                  </strong>
                </div>
              </div>

              {hasProbabilities ? (
                <div
                  className={`agreement-banner ${
                    hasDisagreement
                      ? "agreement-warning"
                      : "agreement-success"
                  }`}
                >
                  {hasDisagreement ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}

                  <div>
                    <strong>
                      {hasDisagreement
                        ? "Model disagreement detected"
                        : "All models agree"}
                    </strong>

                    <p>
                      {hasDisagreement
                        ? selectedDisagrees
                          ? `The selected model predicts ${selectedVote}, while the majority predicts ${majoritySentiment}.`
                          : `${positiveVotes} model(s) predict positive and ${negativeVotes} predict negative.`
                        : `All four models predict ${sentiment}.`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="error-message">
                  The API response does not contain all four model
                  probabilities.
                </div>
              )}
            </>
          )}
        </section>

        {/* BOTTOM: Full-width model probability comparison */}
        <section className="panel model-panel">
          <div className="comparison-heading">
            <div>
              <h3>Model probability comparison</h3>
              <p>
                Compare the positive-class probability predicted by
                each model.
              </p>
            </div>
          </div>

          {!result || !hasProbabilities ? (
            <div className="compact-empty">
              Model comparisons will appear after analysis.
            </div>
          ) : (
            <div className="model-list">
              {probabilities.map((model) => {
                const vote = getVote(model.probability);
                const isBest = model.name === selectedModel;

                return (
                  <div
                    className={`model-row ${
                      isBest ? "model-row-best" : ""
                    }`}
                    key={model.name}
                  >
                    <div className="model-row-top">
                      <div className="model-name-wrap">
                        <span className="model-name">
                          {model.name}
                        </span>

                        {isBest && (
                          <span className="best-badge">
                            Best model
                          </span>
                        )}
                      </div>

                      <span className={`vote-label vote-${vote}`}>
                        {vote}
                      </span>
                    </div>

                    <div className="probability-track">
                      <div
                        className={`probability-fill ${
                          isBest ? "probability-best" : ""
                        }`}
                        style={{
                          width: `${model.probability * 100}%`,
                        }}
                      />
                    </div>

                    <div className="probability-caption">
                      <span>Positive probability</span>
                      <strong>
                        {(model.probability * 100).toFixed(1)}%
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="panel-footnote">
            The best model is selected by evaluation accuracy, not by
            the probability for this individual review.
          </p>
        </section>
      </div>
    </div>
  );
}

export default Analyze;
