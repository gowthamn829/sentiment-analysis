
import { createContext, useContext, useState } from "react";

const BatchContext = createContext(null);

export function BatchProvider({ children }) {
  const [file, setFile] = useState(null);
  const [inputRows, setInputRows] = useState([]);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [sortBy, setSortBy] = useState("uncertain");
  const [elapsedSeconds, setElapsedSeconds] = useState(null);

  return (
    <BatchContext.Provider
      value={{
        file,
        setFile,
        inputRows,
        setInputRows,
        datasetInfo,
        setDatasetInfo,
        loading,
        setLoading,
        error,
        setError,
        results,
        setResults,
        progress,
        setProgress,
        sortBy,
        setSortBy,
        elapsedSeconds,
        setElapsedSeconds,
      }}
    >
      {children}
    </BatchContext.Provider>
  );
}

export function useBatch() {
  const context = useContext(BatchContext);

  if (!context) {
    throw new Error("useBatch must be used inside BatchProvider");
  }

  return context;
}
