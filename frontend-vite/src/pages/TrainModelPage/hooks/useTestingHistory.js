// TrainModelPage/hooks/useTestingHistory.js
import { useState, useEffect, useCallback } from "react";
import {
  getTestHistory,
  getTestMetrics,
  deleteTestSession,
} from "../../../api";

export function useTestingHistory() {
  const [historyList, setHistoryList] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openImprovement, setOpenImprovement] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await getTestHistory();
      setHistoryList(res.data?.sessions || res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleViewMetrics = useCallback(async (id) => {
    try {
      const res = await getTestMetrics(id);
      setSelectedMetrics(res.data || res);
      setOpenDialog(true);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setTimeout(() => setSelectedMetrics(null), 200);
  }, []);

  const handleDeleteSession = useCallback(async (id) => {
    if (!confirm("Delete this test session?")) return;
    try {
      await deleteTestSession(id);
      await loadHistory();
      if (selectedMetrics?.id === id) handleCloseDialog();
    } catch (err) {
      console.error(err);
    }
  }, [loadHistory, selectedMetrics, handleCloseDialog]);

  return {
    historyList,
    selectedMetrics,
    openDialog,
    openImprovement,
    setOpenImprovement,
    loadHistory,
    handleViewMetrics,
    handleCloseDialog,
    handleDeleteSession,
  };
}
