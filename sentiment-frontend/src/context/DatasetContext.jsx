
import { createContext, useContext, useState } from "react";

const DatasetContext = createContext(null);

export function DatasetProvider({ children }) {
  // Shared training and dataset information
  const [trainingResult, setTrainingResult] = useState(null);
  const [activeDataset, setActiveDataset] = useState(null);

  // Workbench state
  const [workbenchFile, setWorkbenchFile] = useState(null);
  const [workbenchPreview, setWorkbenchPreview] = useState(null);
  const [workbenchLoading, setWorkbenchLoading] = useState(false);
  const [workbenchError, setWorkbenchError] = useState("");

  // Analyze state
  const [analyzeText, setAnalyzeText] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  return (
    <DatasetContext.Provider
      value={{
        trainingResult,
        setTrainingResult,
        activeDataset,
        setActiveDataset,

        workbenchFile,
        setWorkbenchFile,
        workbenchPreview,
        setWorkbenchPreview,
        workbenchLoading,
        setWorkbenchLoading,
        workbenchError,
        setWorkbenchError,

        analyzeText,
        setAnalyzeText,
        analyzeResult,
        setAnalyzeResult,
        analyzeLoading,
        setAnalyzeLoading,
        analyzeError,
        setAnalyzeError,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  const context = useContext(DatasetContext);

  if (!context) {
    throw new Error(
      "useDataset must be used inside DatasetProvider"
    );
  }

  return context;
}
