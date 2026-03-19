import { useRef, useEffect } from 'react';
import { getTaskStatus } from '../../../api'; // Cập nhật đường dẫn nếu cần

/**
 * Hook này tự động theo dõi tiến trình của một task ID.
 * Nó chạy khi `taskId` thay đổi từ null -> một giá trị,
 * và tự động dừng khi task hoàn thành, bị hủy, hoặc component unmount.
 */
export function useChangeBgTaskStatus(
  taskId,
  setProgress,
  setLoading,
  setTaskId,
  onSuccess = null
) {
  const progressIntervalRef = useRef(null);

  // Dùng `useRef` để lưu các hàm callback
  // Giúp useEffect không bị chạy lại khi hàm cha re-render
  const callbackRefs = useRef({ setProgress, setLoading, setTaskId, onSuccess });
  
  // Cập nhật ref khi hàm thay đổi
  useEffect(() => {
    callbackRefs.current = { setProgress, setLoading, setTaskId, onSuccess };
  }, [setProgress, setLoading, setTaskId, onSuccess]);


  useEffect(() => {
    // Nếu không có task ID, dọn dẹp interval (nếu có) và thoát
    if (!taskId) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    // Nếu CÓ task ID, bắt đầu polling
    const poll = async () => {
      // Lấy các hàm mới nhất từ ref
      const { 
        setProgress, setLoading, setTaskId, onSuccess 
      } = callbackRefs.current;

      try {
        const response = await getTaskStatus(taskId);
        const status = response.data;
        
        if (status.status === 'completed' || status.status === 'not_found') {
          clearInterval(progressIntervalRef.current);
          setProgress((prev) => ({ ...(prev || {}), message: 'Hoàn tất!' }));
          setLoading(false);
          setTaskId(null);
          if (onSuccess) onSuccess();
        } else if (status.status === 'cancelled') {
          clearInterval(progressIntervalRef.current);
          setProgress((prev) => ({ ...(prev || {}), message: 'Đã dừng' }));
          setLoading(false);
          setTaskId(null);
        } else {
          // Cập nhật tiến trình (ví dụ: { progress: 5, total: 89, message: '...' })
          setProgress(status);
        }
      } catch (error) {
        console.error('Error getting progress:', error);
        clearInterval(progressIntervalRef.current);
        setLoading(false);
        setTaskId(null);
      }
    };

    // Chạy ngay 1 lần để có status liền
    poll(); 
    // Sau đó set interval chạy mỗi 2 giây
    progressIntervalRef.current = setInterval(poll, 2000);

    // Hàm dọn dẹp: chạy khi component unmount hoặc taskId thay đổi
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
    
  // Chỉ phụ thuộc vào `taskId`
  }, [taskId]); 

  // Hook này không cần trả về gì, nó tự chạy ngầm
}