import { useState, useEffect, useRef } from 'react';
import { getTaskStatus } from '../../../api'; // Giả sử api ở src/api/index.js

export function useGenAiTaskStatus(taskId) {
  const [genProgress, setGenProgress] = useState(null);
  const [genIsLoading, setGenIsLoading] = useState(false);
  const [taskIsDone, setTaskIsDone] = useState(false); // Thêm cờ để báo hiệu hoàn thành
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    if (!taskId) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      return;
    }

    // Bắt đầu polling khi có taskId
    setGenIsLoading(true);
    setTaskIsDone(false);
    setGenProgress({ message: 'Starting...' });

    const poll = async () => {
      try {
        const response = await getTaskStatus(taskId);
        const status = response.data;

        if (
          status.status === 'completed' ||
          status.status === 'not_found' ||
          status.status === 'cancelled'
        ) {
          clearInterval(progressIntervalRef.current);
          setGenProgress((prev) => ({
            ...(prev || {}),
            message: status.status === 'completed' ? 'Hoàn tất!' : 'Đã dừng',
          }));
          setGenIsLoading(false);
          setTaskIsDone(true); // Báo hiệu đã xong
        } else {
          setGenProgress(status);
        }
      } catch (error) {
        console.error('Error getting progress:', error);
        clearInterval(progressIntervalRef.current);
        setGenIsLoading(false);
      }
    };

    progressIntervalRef.current = setInterval(poll, 2000);

    // Cleanup
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [taskId]);

  return { genProgress, genIsLoading, setGenIsLoading, taskIsDone };
}