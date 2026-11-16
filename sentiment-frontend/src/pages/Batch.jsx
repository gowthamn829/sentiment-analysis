import { useRef, useState } from "react";
import Papa from "papaparse";
import { useBatch } from "../context/BatchContext";
import {
  ArrowUpFromLine,
  CheckCircle2,
  CircleAlert,
  Database,
  FileSpreadsheet,
  LoaderCircle,
  Play,
  RefreshCw,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { predictSentiment } from "../services/api";
import { logger } from "../services/logger";

const CONCURRENCY = 2;

function Batch() {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [inputRows, setInputRows] = useState([]);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [sortBy, setSortBy] = useState("uncertain");
  const [elapsedSeconds, setElapsedSeconds] = useState(null);

  function handleSelectedFile(selectedFile) {
    if (!selectedFile) return;

    setError("");
    setResults([]);
    setInputRows([]);
    setDatasetInfo(null);
    setElapsedSeconds(null);

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Please select a CSV file.");
      logger.warn("Batch upload rejected: not a CSV file");
      return;
    }

    setFile(selectedFile);

    logger.info("Batch CSV selected", {
      filename: selectedFile.name,
      sizeBytes: selectedFile.size,
    });

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim().toLowerCase(),

      complete: (parsed) => {
        const headers = (parsed.meta.fields || []).filter(Boolean);

        const textColumn = headers.includes("text")
          ? "text"
          : headers.includes("review")
            ? "review"
            : null;

        if (!textColumn) {
          setFile(null);
          setError(
            "This CSV must contain a text or review column."
          );
          logger.warn("Batch CSV missing text/review column", {
            headers,
          });
          return;
        }

        const rows = parsed.data
          .map((row, index) => ({
            rowNumber: index + 1,
            text: String(row[textColumn] ?? "").trim(),
          }))
          .filter((row) => row.text.length > 0);

        if (!rows.length) {
          setFile(null);
          setError("No non-empty reviews were found in this CSV.");
          return;
        }

        setInputRows(rows);
        setDatasetInfo({
          headers,
          rowCount: rows.length,
          textColumn,
          sampleRows: rows.slice(0, 4),
        });

        setProgress({
          completed: 0,
          total: rows.length,
        });

        logger.info("Batch CSV preview completed", {
          filename: selectedFile.name,
          rowCount: rows.length,
          textColumn,
        });

        if (parsed.errors?.length) {
          logger.warn("CSV parser reported issues", {
            count: parsed.errors.length,
          });
        }
      },

      error: (parseError) => {
        setFile(null);
        setError("Could not read the selected CSV file.");

        logger.error("Batch CSV parsing failed", {
          message: parseError.message,
        });
      },
    });
  }

  async function handleBatchAnalyze() {
    if (!inputRows.length || loading) {
      setError("Choose a CSV containing reviews before analyzing.");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);
    setElapsedSeconds(null);

    const startedAt = performance.now();
    const total = inputRows.length;
    let completedResults = [];

    setProgress({
      completed: 0,
      total,
    });

    logger.info("Batch prediction started", {
      filename: file?.name,
      totalReviews: total,
      concurrency: CONCURRENCY,
    });

    try {
      for (
        let offset = 0;
        offset < inputRows.length;
        offset += CONCURRENCY
      ) {
        const currentBatch = inputRows.slice(
          offset,
          offset + CONCURRENCY
        );

        const batchResults = await Promise.all(
          currentBatch.map(async (row) => {
            try {
              const response = await predictSentiment(row.text);
              const probability = Number(response?.probability);

              if (
                !Number.isFinite(probability) ||
                probability < 0 ||
                probability > 1
              ) {
                throw new Error(
                  "The API returned an invalid probability."
                );
              }

              const returnedSentiment = String(
                response?.sentiment ?? ""
              ).toLowerCase();

              const sentiment =
                returnedSentiment === "positive" ||
                returnedSentiment === "negative"
                  ? returnedSentiment
                  : probability >= 0.5
                    ? "positive"
                    : "negative";

              const confidence =
                sentiment === "positive"
                  ? probability
                  : 1 - probability;

              return {
                ...row,
                status: "success",
                sentiment,
                probability,
                confidence,
                modelUsed: response?.model_used || "Unknown",
                errorMessage: "",
              };
            } catch (err) {
              logger.warn("Batch review prediction failed", {
                rowNumber: row.rowNumber,
                message: err.message,
              });

              return {
                ...row,
                status: "error",
                sentiment: "error",
                probability: null,
                confidence: null,
                modelUsed: "Unavailable",
                errorMessage:
                  err.response?.data?.detail ||
                  err.message ||
                  "Prediction failed",
              };
            }
          })
        );

        completedResults = [
          ...completedResults,
          ...batchResults,
        ];

        setResults([...completedResults]);
        setProgress({
          completed: completedResults.length,
          total,
        });
      }

      const duration = (performance.now() - startedAt) / 1000;
      setElapsedSeconds(duration);

      const succeeded = completedResults.filter(
        (row) => row.status === "success"
      ).length;

      logger.info("Batch prediction completed", {
        total,
        succeeded,
        failed: total - succeeded,
        elapsedSeconds: Number(duration.toFixed(2)),
      });
    } catch (err) {
      logger.error("Batch analysis failed", {
        message: err.message,
      });

      setError("Batch analysis could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  function resetBatch() {
    setFile(null);
    setInputRows([]);
    setDatasetInfo(null);
    setResults([]);
    setError("");
    setElapsedSeconds(null);
    setProgress({
      completed: 0,
      total: 0,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    logger.info("Batch workspace reset");
  }

  const successfulResults = results.filter(
    (row) => row.status === "success"
  );

  const positiveCount = successfulResults.filter(
    (row) => row.sentiment === "positive"
  ).length;

  const negativeCount = successfulResults.filter(
    (row) => row.sentiment === "negative"
  ).length;

  const uncertainCount = successfulResults.filter(
    (row) => row.confidence < 0.6
  ).length;

  const failedCount = results.length - successfulResults.length;

  const sentimentData = [
    { name: "Positive", value: positiveCount },
    { name: "Negative", value: negativeCount },
  ];

  const sortedResults = [...results].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "error" ? 1 : -1;
    }

    if (a.status === "error") {
      return a.rowNumber - b.rowNumber;
    }

    if (sortBy === "confident") {
      return b.confidence - a.confidence;
    }

    if (sortBy === "positive") {
      return b.probability - a.probability;
    }

    if (sortBy === "negative") {
      return a.probability - b.probability;
    }

    // Default: least confident / most uncertain first.
    return a.confidence - b.confidence;
  });

  const progressPercent =
    progress.total > 0
      ? (progress.completed / progress.total) * 100
      : 0;

  const formatConfidence = (confidence) =>
    confidence == null
      ? "—"
      : `${(confidence * 100).toFixed(1)}%`;

  return (
    <div className="batch-page">
      <div className="batch-intro">
        <div>
          <h2>Batch analysis</h2>
          <p>
            Analyze multiple reviews and find uncertain sentiment
            predictions across your dataset.
          </p>
        </div>

        <span className="batch-model-count">
          <Database size={15} />
          Multi-review analysis
        </span>
      </div>

      <div className="batch-upload-grid">
        {/* Upload CSV */}
        <section className="panel batch-upload-panel">
          <div className="panel-heading">
            <div className="section-icon">
              <FileSpreadsheet size={19} />
            </div>

            <div>
              <h3>Upload reviews</h3>
              <p>Choose a CSV containing text or review</p>
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
            disabled={loading}
          />

          <div
            className={`batch-dropzone ${
              dragging ? "batch-dropzone-active" : ""
            }`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!loading) fileInputRef.current?.click();
            }}
            onKeyDown={(event) => {
              if (
                !loading &&
                (event.key === "Enter" || event.key === " ")
              ) {
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
              if (
                !event.currentTarget.contains(event.relatedTarget)
              ) {
                setDragging(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);

              if (!loading) {
                handleSelectedFile(event.dataTransfer.files?.[0]);
              }
            }}
          >
            <div className="batch-dropzone-icon">
              <ArrowUpFromLine size={24} />
            </div>

            <h3>
              {dragging
                ? "Drop your CSV here"
                : "Drag and drop your CSV"}
            </h3>

            <p>or click to browse files</p>

            <span>CSV files only · A text or review column is required</span>
          </div>

          {file && datasetInfo && (
            <div className="batch-file-summary">
              <FileSpreadsheet size={20} />

              <div>
                <strong>{file.name}</strong>
                <span>
                  {datasetInfo.rowCount.toLocaleString()} non-empty
                  reviews · {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>

              <button
                type="button"
                className="batch-reset-icon"
                title="Remove dataset"
                onClick={resetBatch}
                disabled={loading}
              >
                <RefreshCw size={15} />
              </button>
            </div>
          )}

          {error && (
            <div className="error-message batch-error" role="alert">
              <CircleAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            className="primary-button batch-run-button"
            onClick={handleBatchAnalyze}
            disabled={!inputRows.length || loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="spin-icon" size={17} />
                Analyzing {progress.completed} of {progress.total}
              </>
            ) : (
              <>
                <Play size={17} />
                Analyze all reviews
              </>
            )}
          </button>

          <p className="batch-info-note">
            Each review is sent to the existing prediction endpoint.
            Large CSV files may take longer to process.
          </p>
        </section>

        {/* CSV snapshot */}
        <section className="panel batch-snapshot-panel">
          <div className="panel-heading">
            <div className="section-icon">
              <Database size={19} />
            </div>

            <div>
              <h3>Dataset snapshot</h3>
              <p>Review count and sample records</p>
            </div>
          </div>

          {!datasetInfo ? (
            <div className="batch-empty-snapshot">
              <FileSpreadsheet size={29} />
              <h3>No file selected</h3>
              <p>
                Upload an unlabeled CSV to preview its reviews before
                running batch predictions.
              </p>
            </div>
          ) : (
            <>
              <div className="batch-snapshot-stats">
                <div>
                  <span>Non-empty reviews</span>
                  <strong>
                    {datasetInfo.rowCount.toLocaleString()}
                  </strong>
                </div>

                <div>
                  <span>Columns detected</span>
                  <strong>{datasetInfo.headers.length}</strong>
                </div>
              </div>

              <div className="batch-detected-columns">
                <span>Detected columns</span>

                <div>
                  {datasetInfo.headers.map((header) => (
                    <code key={header}>{header}</code>
                  ))}
                </div>
              </div>

              <div className="batch-sample-list">
                <h4>Review preview</h4>

                {datasetInfo.sampleRows.slice(0, 3).map((row) => (
                  <div
                    className="batch-sample-row"
                    key={row.rowNumber}
                  >
                    <span>{row.rowNumber}</span>
                    <p title={row.text}>{row.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Progress */}
      {loading && (
        <section className="panel batch-progress-panel">
          <div className="batch-progress-heading">
            <LoaderCircle className="spin-icon" size={19} />
            <div>
              <h3>Batch prediction in progress</h3>
              <p>
                Completed {progress.completed} of {progress.total} reviews
              </p>
            </div>

            <strong>{progressPercent.toFixed(0)}%</strong>
          </div>

          <div
            className="batch-progress-track"
            role="progressbar"
            aria-valuenow={progress.completed}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <div style={{ width: `${progressPercent}%` }} />
          </div>
        </section>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <div className="batch-results-heading">
            <div>
              <h2>Batch results</h2>
              <p>
                Review the sentiment split and inspect borderline
                predictions first.
              </p>
            </div>

            {elapsedSeconds !== null && (
              <span className="batch-duration">
                Completed in {elapsedSeconds.toFixed(1)} seconds
              </span>
            )}
          </div>

          <div className="batch-stat-grid">
            <section className="panel batch-stat-card">
              <span>Predictions completed</span>
              <strong>{successfulResults.length}</strong>
              <p>Successful predictions</p>
            </section>

            <section className="panel batch-stat-card">
              <span>Positive</span>
              <strong className="batch-positive-value">
                {positiveCount}
              </strong>
              <p>
                {successfulResults.length
                  ? `${(
                      (positiveCount / successfulResults.length) *
                      100
                    ).toFixed(1)}% of predictions`
                  : "No predictions yet"}
              </p>
            </section>

            <section className="panel batch-stat-card">
              <span>Negative</span>
              <strong className="batch-negative-value">
                {negativeCount}
              </strong>
              <p>
                {successfulResults.length
                  ? `${(
                      (negativeCount / successfulResults.length) *
                      100
                    ).toFixed(1)}% of predictions`
                  : "No predictions yet"}
              </p>
            </section>

            <section className="panel batch-stat-card">
              <span>Borderline</span>
              <strong className="batch-uncertain-value">
                {uncertainCount}
              </strong>
              <p>Class confidence below 60%</p>
            </section>
          </div>

          {failedCount > 0 && (
            <div className="batch-failure-note">
              <CircleAlert size={16} />
              {failedCount} review(s) could not be analyzed. Their
              error details are available in the results table.
            </div>
          )}

          <div className="batch-results-grid">
            <section className="panel batch-chart-panel">
              <div className="batch-section-heading">
                <div>
                  <h3>Sentiment distribution</h3>
                  <p>Positive and negative predictions</p>
                </div>
              </div>

              {successfulResults.length > 0 ? (
                <>
                  <div className="batch-donut-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={57}
                          outerRadius={82}
                          paddingAngle={3}
                          stroke="none"
                        >
                          <Cell fill="#35ad70" />
                          <Cell fill="#e16c68" />
                        </Pie>

                        <Tooltip
                          formatter={(value, name) => [
                            `${value} reviews`,
                            name,
                          ]}
                          contentStyle={{
                            border: "1px solid #e6e9ef",
                            borderRadius: "7px",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="batch-donut-center">
                      <strong>{successfulResults.length}</strong>
                      <span>reviews</span>
                    </div>
                  </div>

                  <div className="batch-chart-legend">
                    <div>
                      <span className="batch-legend-dot batch-legend-positive" />
                      <span>Positive</span>
                      <strong>{positiveCount}</strong>
                    </div>

                    <div>
                      <span className="batch-legend-dot batch-legend-negative" />
                      <span>Negative</span>
                      <strong>{negativeCount}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <p className="batch-empty-results">
                  No successful predictions to display.
                </p>
              )}
            </section>

            {/* Sortable review results */}
            <section className="panel batch-table-panel">
              <div className="batch-section-heading batch-table-heading">
                <div>
                  <h3>Review predictions</h3>
                  <p>
                    Uncertain predictions appear first by default.
                  </p>
                </div>

                <label className="batch-sort-control">
                  <span>Sort by</span>

                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                  >
                    <option value="uncertain">
                      Most uncertain
                    </option>
                    <option value="confident">
                      Most confident
                    </option>
                    <option value="positive">
                      Highest positive probability
                    </option>
                    <option value="negative">
                      Lowest positive probability
                    </option>
                  </select>
                </label>
              </div>

              <div className="batch-table-wrapper">
                <table className="batch-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Review</th>
                      <th>Sentiment</th>
                      <th>Confidence</th>
                      <th>Model</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedResults.map((row) => (
                      <tr
                        key={`${row.rowNumber}-${row.text}`}
                        className={
                          row.status === "error"
                            ? "batch-row-error"
                            : row.confidence < 0.6
                              ? "batch-row-uncertain"
                              : ""
                        }
                      >
                        <td>{row.rowNumber}</td>

                        <td
                          className="batch-review-cell"
                          title={
                            row.status === "error"
                              ? row.errorMessage
                              : row.text
                          }
                        >
                          {row.text}
                        </td>

                        <td>
                          {row.status === "error" ? (
                            <span className="batch-sentiment-error">
                              Failed
                            </span>
                          ) : (
                            <span
                              className={`batch-sentiment-pill ${
                                row.sentiment === "positive"
                                  ? "batch-sentiment-positive"
                                  : "batch-sentiment-negative"
                              }`}
                            >
                              {row.sentiment}
                            </span>
                          )}
                        </td>

                        <td>{formatConfidence(row.confidence)}</td>

                        <td className="batch-model-cell">
                          {row.modelUsed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export default Batch;