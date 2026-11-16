
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Target,
  TrendingUp,
} from "lucide-react";
import { useDataset } from "../context/DatasetContext";

function Insights() {
  const { trainingResult, activeDataset } = useDataset();

  const metrics = Array.isArray(trainingResult?.metrics)
    ? trainingResult.metrics
    : [];

  const bestModel = metrics.length
    ? metrics.reduce((best, model) =>
        Number(model.accuracy) > Number(best.accuracy)
          ? model
          : best
      )
    : null;

  const trainingMinutes =
    trainingResult?.training_time_minutes ??
    (trainingResult?.training_time_seconds != null
      ? Number(trainingResult.training_time_seconds) / 60
      : activeDataset?.trainingTimeMinutes);

  const chartData = metrics.map((metric) => ({
    model: metric.model,
    accuracy: Number(metric.accuracy) * 100,
  }));

  const formatPercent = (value) =>
    `${(Number(value ?? 0) * 100).toFixed(2)}%`;

  const datasetName =
    trainingResult?.filename ||
    activeDataset?.filename ||
    "No dataset";

  const rows = Number(
    trainingResult?.rows ?? activeDataset?.rows ?? 0
  );

  const trainingSamples = Number(
    trainingResult?.training_samples ?? 0
  );

  const testingSamples = Number(
    trainingResult?.testing_samples ?? 0
  );

  if (!metrics.length) {
    return (
      <div className="insights-page">
        <div className="insights-intro">
          <div>
            <h2>Model insights</h2>
            <p>
              Explore model performance and compare the ensemble.
            </p>
          </div>
        </div>

        <section className="panel insights-empty">
          <div className="insights-empty-icon">
            <BarChart3 size={27} />
          </div>

          <h3>No training results available</h3>

          <p>
            Upload a labeled dataset and train the models in
            Workbench. Their evaluation metrics will appear here.
          </p>

          <Link to="/workbench" className="insights-action">
            Open workbench
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="insights-page">
      <div className="insights-intro">
        <div>
          <h2>Model insights</h2>
          <p>
            Evaluate all four models and understand which performs
            best on the current dataset.
          </p>
        </div>

        <div className="insights-dataset-chip">
          <Database size={15} />
          <span title={datasetName}>{datasetName}</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="insights-stat-grid">
        <div className="panel insights-stat-card">
          <div className="insights-stat-top">
            <span>Dataset rows</span>
            <Database size={17} />
          </div>
          <strong>{rows.toLocaleString()}</strong>
          <p>Processed records</p>
        </div>

        <div className="panel insights-stat-card">
          <div className="insights-stat-top">
            <span>Training samples</span>
            <TrendingUp size={17} />
          </div>
          <strong>{trainingSamples.toLocaleString()}</strong>
          <p>Used to train the models</p>
        </div>

        <div className="panel insights-stat-card">
          <div className="insights-stat-top">
            <span>Best accuracy</span>
            <Target size={17} />
          </div>
          <strong className="insights-highlight">
            {formatPercent(bestModel?.accuracy)}
          </strong>
          <p>{bestModel?.model || "Not available"}</p>
        </div>

        <div className="panel insights-stat-card">
          <div className="insights-stat-top">
            <span>Training duration</span>
            <Clock3 size={17} />
          </div>
          <strong>
            {trainingMinutes != null
              ? `${Number(trainingMinutes).toFixed(2)} min`
              : "N/A"}
          </strong>
          <p>Full pipeline duration</p>
        </div>
      </div>

      {/* Accuracy chart */}
      <section className="panel insights-chart-panel">
        <div className="insights-section-heading">
          <div>
            <h3>Accuracy comparison</h3>
            <p>
              Compare the accuracy reported for each model.
            </p>
          </div>

          <span className="chart-unit">Percentage</span>
        </div>

        <div className="accuracy-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 16,
                right: 12,
                left: 0,
                bottom: 8,
              }}
            >
              <CartesianGrid
                stroke="#edf0f4"
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="model"
                tickFormatter={(name) =>
                  name === "Stacking Ensemble" ? "Stacking" : name
                }
                tick={{
                  fill: "#727c8f",
                  fontSize: 11,
                }}
                axisLine={{ stroke: "#e5e8ee" }}
                tickLine={false}
                interval={0}
              />

              <YAxis
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                tick={{
                  fill: "#8991a0",
                  fontSize: 10,
                }}
                axisLine={false}
                tickLine={false}
                width={43}
              />

              <Tooltip
                formatter={(value) => [
                  `${Number(value).toFixed(2)}%`,
                  "Accuracy",
                ]}
                contentStyle={{
                  border: "1px solid #e6e9ef",
                  borderRadius: "7px",
                  fontSize: "12px",
                }}
              />

              <Bar
                dataKey="accuracy"
                name="Accuracy"
                radius={[5, 5, 0, 0]}
                maxBarSize={65}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.model}
                    fill={
                      entry.model === bestModel?.model
                        ? "#805bd8"
                        : "#a7b0c0"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-legend">
          <span className="chart-legend-dot" />
          <span>Purple indicates the highest-accuracy model.</span>
        </div>
      </section>

      {/* All model metrics */}
      <section className="panel insights-table-panel">
        <div className="insights-section-heading">
          <div>
            <h3>Performance metrics</h3>
            <p>
              Accuracy, Precision, Recall and F1-score for every model.
            </p>
          </div>

          <span className="model-total">{metrics.length} models</span>
        </div>

        <div className="insights-table-wrapper">
          <table className="insights-table">
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
                    className={isBest ? "insights-best-row" : ""}
                  >
                    <td>
                      <span className="insights-model-name">
                        {metric.model}
                      </span>

                      {isBest && (
                        <span className="insights-best-badge">
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
      </section>

      {/* Why the model won */}
      {bestModel && (
        <section className="insights-winner-note">
          <div className="winner-note-icon">
            <CheckCircle2 size={20} />
          </div>

          <div>
            <h3>Why {bestModel.model} was selected</h3>

            <p>
              It achieved the highest reported accuracy among the
              evaluated models at{" "}
              <strong>{formatPercent(bestModel.accuracy)}</strong>.
              Precision, recall and F1-score are also available above
              for a broader comparison.
            </p>
          </div>
        </section>
      )}

      <div className="insights-footer">
        Testing samples: {testingSamples.toLocaleString()}
      </div>
    </div>
  );
}

export default Insights;
