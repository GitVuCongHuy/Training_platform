import { useState, useEffect, useRef } from 'react';
import { getTestStatus, getTestMetrics } from '../../../api';

export function useTestStatus(testId) {
  const [statusData, setStatusData] = useState(null);
  const [testMetrics, setTestMetrics] = useState(null);
  const [testCm, setTestCm] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    if (!testId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    
    setStatusData(null);
    setTestMetrics(null);
    setTestCm(null);

    const fetchStatus = async () => {
      try {
        const st = await getTestStatus(testId);
        const data = st.data ? st.data : st;
        setStatusData(data);

        if (data.status === 'finished' || data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (data.status === 'finished') {
            const res = await getTestMetrics(testId);
            setTestMetrics(res.data?.metrics || null);
            setTestCm(res.data?.confusion_matrix || null);
          }
        }
      } catch (err) {
        console.error('poll error', err);
      }
    };

    pollingRef.current = setInterval(fetchStatus, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [testId]);

  return { statusData, testMetrics, testCm, setStatusData };
}