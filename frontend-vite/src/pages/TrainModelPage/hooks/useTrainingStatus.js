import { useState, useEffect, useRef } from 'react';
import { getTrainingStatus } from '../../../api';

export function useTrainingStatus(trainingId) {
  const [statusData, setStatusData] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    if (!trainingId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const fetchStatus = async () => {
      try {
        const st = await getTrainingStatus(trainingId);
        const data = st.data ? st.data : st;
        setStatusData(data);
        if (data.status === 'finished' || data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        console.error('poll error', err);
      }
    };

    // Fetch immediately when trainingId changes
    fetchStatus();

    // Then continue polling every 2 seconds
    pollingRef.current = setInterval(fetchStatus, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [trainingId]);

  return [statusData, setStatusData];
}