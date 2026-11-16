
import { useRef, useState } from "react";
import { useDataset } from "../context/DatasetContext";

import Papa from "papaparse";
import {
  ArrowUpFromLine,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileSpreadsheet,
  LoaderCircle,
  Play,
  RefreshCw,
} from "lucide-react";
import { uploadDataset } from "../services/api";
import { logger } from "../services/logger";

function Workbench() {
  const fileInputRef = useRef(null);
const {
  workbenchFile: file,
  setWorkbenchFile: setFile,

  workbenchPreview: preview,
  setWorkbenchPreview: setPreview,

  workbenchLoading: loading,
  setWorkbenchLoading: setLoading,

  workbenchError: error,
  setWorkbenchError: setError,
  trainingResult,
  setTrainingResult,
  setActiveDataset,
} = useDataset();
  const [dragging, setDragging] = useState(false);

  function handleSelectedFile(selectedFile) {
    if (!selectedFile) return;

    setError("");
    setTrainingResult(null);
    setPreview(null);

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Please select a CSV file.");
      logger.warn("Dataset upload rejected: not a CSV file");
      return;
    }

    setFile(selectedFile);

    logger.info("CSV selected for preview", {
      filename: selectedFile.name,
      sizeBytes: selectedFile.size,
    });

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim().toLowerCase(),

      complete: (parsed) => {
        const headers = (parsed.meta.fields || []).filter(Boolean);

        const rows = parsed.data.filter((row) =>
          Object.values(row).some(
            (value) => String(value ?? "").trim() !== ""
          )
        );

        const textColumn = headers.includes("text")
          ? "text"
          : headers.includes("review")
            ? "review"
            : null;

        const hasSentiment = headers.includes("sentiment");
        const valid = Boolean(textColumn && hasSentiment);

        let positive = 0;
        let negative = 0;
        let neutral = 0;
        let other = 0;

        for (const row of rows) {
          const label = String(row.sentiment ?? "")
            .trim()
            .toLowerCase();

          if (["positive", "1"].includes(label)) {
            positive++;
          } else if (["negative", "0"].includes(label)) {
            negative++;
          } else if (label === "neutral") {
            neutral++;
          } else {
            other++;
          }
        }

        const snapshot = {
          headers,
          rowCount: rows.length,
          textColumn,
          valid,
          positive,
          negative,
          neutral,
          other,
          sampleRows: rows.slice(0, 4).map((row) => ({
            text: String(row[textColumn] ?? ""),
            sentiment: String(row.sentiment ?? ""),
          })),
        };

        setPreview(snapshot);

        logger.info("CSV preview completed", {
          rows: snapshot.rowCount,
          headers: snapshot.headers,
          valid: snapshot.valid,
        });

        if (!valid) {
          setError(
            "The CSV must contain a text or review column and a sentiment column."
          );
        } else if (rows.length === 0) {
          setError("The CSV does not contain any data rows.");
        } else if (parsed.errors?.length) {
          logger.warn("CSV parser reported issues", {
            count: parsed.errors.length,
          });
        }
      },

      error: (parseError) => {
        logger.error("CSV preview failed", {
          message: parseError.message,
        });

        setPreview(null);
        setError("Could not read this CSV file.");
      },
    });
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    handleSelectedFile(event.dataTransfer.files?.[0]);
  }

  async function handleTrain() {
    if (!file || !preview?.valid || preview.rowCount === 0) {
      setError("Select a valid labeled CSV file before training.");
      return;
    }

    setLoading(true);
    setError("");
    setTrainingResult(null);

    logger.info("Ensemble training requested", {
      filename: file.name,
      rows: preview.rowCount,
    });

    try {
      const response = await uploadDataset(file);

      logger.info("Dataset training response received", {
        status: response?.status,
        filename: response?.filename,
        rows: response?.rows,
        trainingTimeMinutes: response?.training_time_minutes,
        models: response?.models,
      });

      if (response?.status !== "success") {
        throw new Error(
          response?.message || "Dataset training did not succeed."
        );
      }

      setTrainingResult(response);


setActiveDataset({
  filename: response.filename || file.name,
  rows: response.rows ?? preview.rowCount,
  trainingTimeMinutes:
    response.training_time_minutes ??
    (response.training_time_seconds != null
      ? Number(response.training_time_seconds) / 60
      : null),
});
    } catch (err) {
      logger.error("Dataset training failed", {
        message: err.message,
        status: err.response?.status,
        detail: err.response?.data?.detail,
      });

      setError(
        err.response?.data?.detail ||
          err.message ||
          "Training failed. Check that FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetWorkbench() {
    setFile(null);
    setPreview(null);
    setTrainingResult(null);
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    logger.info("Workbench reset");
  }

  const metrics = trainingResult?.metrics || [];

  const bestModel = metrics.length
    ? metrics.reduce((best, item) =>
        Number(item.accuracy) > Number(best.accuracy) ? item : best
      )
    : null;

  const positiveNegativeTotal =
    (preview?.positive || 0) + (preview?.negative || 0);

  const positivePercent =
    positiveNegativeTotal > 0
      ? (preview.positive / positiveNegativeTotal) * 100
      : 0;

  const negativePercent =
    positiveNegativeTotal > 0
      ? (preview.negative / positiveNegativeTotal) * 100
      : 0;

  const formatPercent = (value) =>
    `${(Number(value || 0) * 100).toFixed(2)}%`;

  const trainingMinutes =
    trainingResult?.training_time_minutes ??
    (trainingResult?.training_time_seconds != null
      ? Number(trainingResult.training_time_seconds) / 60
      : null);

  return (
    <div className="workbench-page">
      <div className="workbench-intro">
        <div>
          <h2>Dataset workbench</h2>
          <p>
            Prepare a labeled dataset and train your sentiment
            analysis ensemble.
          </p>
        </div>

        <span className="workbench-model-count">
          <Database size={15} />
          4 models
        </span>
      </div>

      <div className="workbench-grid">
        {/* Dataset upload */}
        <section className="panel workbench-upload-panel">
          <div className="panel-heading">
            <div className="section-icon">
              <FileSpreadsheet size={19} />
            </div>

            <div>
              <h3>Upload dataset</h3>
              <p>Choose a labeled CSV file</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              handleSelectedFile(event.target.files?.[0])
            }
          />

          <div
            className={`dataset-dropzone ${
              dragging ? "dataset-dropzone-active" : ""
            }`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setDragging(false);
              }
            }}
            onDrop={handleDrop}
          >
            <div className="dropzone-icon">
              <ArrowUpFromLine size={24} />
            </div>

            <h3>
              {dragging ? "Drop your CSV here" : "Drag and drop your CSV"}
            </h3>

            <p>or click to browse files</p>

            <span className="dropzone-format">
              CSV files only
            </span>
          </div>

          {file && (
            <div className="selected-file">
              <FileSpreadsheet size={19} />

              <div className="selected-file-details">
                <strong>{file.name}</strong>
                <span>
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>

              <button
                type="button"
                className="text-action"
                onClick={(event) => {
                  event.stopPropagation();
                  resetWorkbench();
                }}
                disabled={loading}
              >
                Remove
              </button>
            </div>
          )}

          <div className="required-columns">
            <span>Required columns</span>
            <div>
              <code>text</code>
              <span>or</span>
              <code>review</code>
              <span>+</span>
              <code>sentiment</code>
            </div>
          </div>

          {error && (
            <div className="error-message" role="alert">
              <CircleAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            className="primary-button train-button"
            onClick={handleTrain}
            disabled={!file || !preview?.valid || preview.rowCount === 0 || loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="spin-icon" size={17} />
                Training ensemble...
              </>
            ) : (
              <>
                <Play size={17} />
                Train ensemble
              </>
            )}
          </button>

          <p className="workbench-note">
            Training replaces the previously saved models when it
            completes successfully.
          </p>
        </section>

        {/* Dataset snapshot */}
        <section className="panel dataset-snapshot-panel">
          <div className="panel-heading">
            <div className="section-icon">
              <Database size={19} />
            </div>

            <div>
              <h3>Dataset snapshot</h3>
              <p>Preview before starting training</p>
            </div>
          </div>

          {!preview ? (
            <div className="snapshot-empty">
              <FileSpreadsheet size={30} />
              <h3>No dataset selected</h3>
              <p>
                Upload a CSV to view the number of rows and
                sentiment distribution.
              </p>
            </div>
          ) : (
            <>
              <div className="snapshot-stats">
                <div className="snapshot-stat">
                  <span>Dataset rows</span>
                  <strong>
                    {preview.rowCount.toLocaleString()}
                  </strong>
                </div>

                <div className="snapshot-stat">
                  <span>Columns detected</span>
                  <strong>{preview.headers.length}</strong>
                </div>
              </div>

              <div className="class-balance">
                <div className="balance-heading">
                  <h4>Sentiment balance</h4>
                  <span>
                    {positiveNegativeTotal.toLocaleString()} labeled
                    positive/negative rows
                  </span>
                </div>

                <div
                  className="balance-bar"
                  aria-label="Positive and negative class balance"
                >
                  <span
                    className="balance-positive"
                    style={{ width: `${positivePercent}%` }}
                  />
                  <span
                    className="balance-negative"
                    style={{ width: `${negativePercent}%` }}
                  />
                </div>

                <div className="balance-legend">
                  <div>
                    <span className="legend-dot positive-dot" />
                    <span>Positive</span>
                    <strong>
                      {preview.positive.toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span className="legend-dot negative-dot" />
                    <span>Negative</span>
                    <strong>
                      {preview.negative.toLocaleString()}
                    </strong>
                  </div>
                </div>

                {(preview.neutral > 0 || preview.other > 0) && (
                  <p className="balance-extra">
                    Neutral: {preview.neutral.toLocaleString()}
                    {" · "}
                    Other or unlabeled: {preview.other.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="column-check">
                <span>Detected columns</span>

                <div className="column-chips">
                  {preview.headers.map((header) => (
                    <span key={header} className="column-chip">
                      {header}
                    </span>
                  ))}
                </div>

                <div
                  className={`validation-status ${
                    preview.valid ? "validation-valid" : "validation-invalid"
                  }`}
                >
                  {preview.valid ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <CircleAlert size={15} />
                  )}

                  {preview.valid
                    ? "Required columns found"
                    : "Required columns missing"}
                </div>
              </div>

              {preview.sampleRows.length > 0 && (
                <div className="csv-preview">
                  <h4>Sample rows</h4>

                  {preview.sampleRows.slice(0, 3).map((row, index) => (
                    <div className="csv-preview-row" key={index}>
                      <span title={row.text}>{row.text || "(empty text)"}</span>
                      <small>{row.sentiment || "Unlabeled"}</small>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Training pipeline */}
      <section className="panel pipeline-panel">
        <div className="pipeline-heading">
          <div>
            <h3>Training pipeline</h3>
            <p>
              Preprocessing, base-model training, stacking, evaluation
              and model saving.
            </p>
          </div>

          {trainingResult && (
            <span className="training-complete-badge">
              <CheckCircle2 size={14} />
              Completed
            </span>
          )}
        </div>

        {loading ? (
          <div className="training-running">
            <LoaderCircle className="spin-icon" size={23} />
            <div>
              <strong>Training pipeline is running</strong>
              <p>
                FastAPI is processing the dataset and training the
                models. Results will appear when the request completes.
              </p>
            </div>
          </div>
        ) : (
          <div className="pipeline-stages">
            {[
              "Validate and preprocess",
              "Train Naive Bayes, SVM and CNN",
              "Generate out-of-fold predictions",
              "Train stacking meta-classifier",
              "Evaluate and save models",
            ].map((stage, index) => (
              <div
                key={stage}
                className={`pipeline-stage ${
                  trainingResult ? "pipeline-stage-complete" : ""
                }`}
              >
                <span className="pipeline-stage-icon">
                  {trainingResult ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>

                <span>{stage}</span>
              </div>
            ))}
          </div>
        )}

        {trainingResult && (
          <div className="training-summary">
            <div className="summary-item">
              <span>Processed rows</span>
              <strong>
                {Number(trainingResult.rows ?? preview?.rowCount ?? 0).toLocaleString()}
              </strong>
            </div>

            <div className="summary-item">
              <span>Training samples</span>
              <strong>
                {Number(trainingResult.training_samples ?? 0).toLocaleString()}
              </strong>
            </div>

            <div className="summary-item">
              <span>Testing samples</span>
              <strong>
                {Number(trainingResult.testing_samples ?? 0).toLocaleString()}
              </strong>
            </div>

            <div className="summary-item">
              <span>Training time</span>
              <strong>
                {trainingMinutes !== null
                  ? `${Number(trainingMinutes).toFixed(2)} min`
                  : "Not returned"}
              </strong>
            </div>
          </div>
        )}
      </section>

      {/* Actual evaluation results */}
      {trainingResult && (
        <section className="panel workbench-metrics-panel">
          <div className="pipeline-heading">
            <div>
              <h3>Training results</h3>
              <p>
                Metrics returned by your FastAPI training pipeline.
              </p>
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={resetWorkbench}
            >
              <RefreshCw size={15} />
              New dataset
            </button>
          </div>

          {bestModel && (
            <div className="best-model-summary">
              <div className="best-model-icon">
                <CheckCircle2 size={20} />
              </div>

              <div>
                <span>Best-performing model by accuracy</span>
                <strong>{bestModel.model}</strong>
              </div>

              <div className="best-model-accuracy">
                {(Number(bestModel.accuracy) * 100).toFixed(2)}%
                <span>Accuracy</span>
              </div>
            </div>
          )}

          <div className="metrics-table-wrapper">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Accuracy</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>F1-score</th>
                </tr>
              </thead>

              <tbody>
                {metrics.map((metric) => {
                  const isBest = metric.model === bestModel?.model;

                  return (
                    <tr
                      key={metric.model}
                      className={isBest ? "best-metric-row" : ""}
                    >
                      <td>
                        <span>{metric.model}</span>
                        {isBest && (
                          <span className="best-badge">
                            Best
                          </span>
                        )}
                      </td>
                      <td>{formatPercent(metric.accuracy)}</td>
                      <td>{formatPercent(metric.precision)}</td>
                      <td>{formatPercent(metric.recall)}</td>
                      <td>{formatPercent(metric.f1_score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!metrics.length && (
            <p className="metrics-empty">
              The response did not include evaluation metrics.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default Workbench;
