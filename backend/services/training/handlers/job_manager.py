# backend/services/training/handlers/job_manager.py
"""
Job Manager - quản lý threads và training/testing jobs
"""
from typing import Dict, Any, Optional
import threading
import ctypes

_job_lock = threading.Lock()

ACTIVE_JOBS: Dict[int, Any] = {}
ACTIVE_THREADS: Dict[int, threading.Thread] = {}


def _raise_exception_in_thread(thread_id: int, exception_type):
    """Raise an exception in a thread with the given thread_id."""
    res = ctypes.pythonapi.PyThreadState_SetAsyncExc(
        ctypes.c_ulong(thread_id),
        ctypes.py_object(exception_type)
    )
    if res == 0:
        raise ValueError(f"Invalid thread id: {thread_id}")
    elif res > 1:
        ctypes.pythonapi.PyThreadState_SetAsyncExc(ctypes.c_ulong(thread_id), None)
        raise SystemError("PyThreadState_SetAsyncExc failed")


class JobManager:
    """
    Singleton manager để theo dõi và điều khiển các training/testing jobs.
    """
    
    def __init__(self):
        global ACTIVE_JOBS, ACTIVE_THREADS, _job_lock
        self.jobs = ACTIVE_JOBS
        self.threads = ACTIVE_THREADS
        self.lock = _job_lock

    def register_job(self, job_id: int, trainer_instance, thread: threading.Thread = None):
        """Đăng ký một trainer instance mới khi bắt đầu job."""
        with self.lock:
            self.jobs[job_id] = trainer_instance
            if thread:
                self.threads[job_id] = thread

    def register_thread(self, job_id: int, thread: threading.Thread):
        """Đăng ký thread cho một job đang chạy."""
        with self.lock:
            self.threads[job_id] = thread

    def get_job(self, job_id: int):
        """Lấy trainer instance từ job_id."""
        with self.lock:
            return self.jobs.get(job_id)

    def request_stop(self, job_id: int):
        """
        Yêu cầu stop một job đang chạy.
        Raise KeyboardInterrupt trong training thread để YOLO gracefully exit.
        """
        trainer = self.get_job(job_id)
        if trainer and hasattr(trainer, 'stop'):
            trainer.stop()
        
        with self.lock:
            thread = self.threads.get(job_id)
        
        if thread and thread.is_alive():
            try:
                _raise_exception_in_thread(thread.ident, KeyboardInterrupt)
                print(f"[JobManager] Sent KeyboardInterrupt to training thread for job {job_id}")
            except Exception as e:
                print(f"[JobManager] Failed to interrupt thread for job {job_id}: {e}")

    def get_progress(self, job_id: int) -> Optional[Dict[str, Any]]:
        """Lấy progress hiện tại từ trainer instance."""
        trainer = self.get_job(job_id)
        if trainer and hasattr(trainer, 'get_progress'):
            return trainer.get_progress()
        
        job = self.jobs.get(job_id)
        if not job:
            return None
        
        return getattr(job, 'state', None)

    def clear_job_if_done(self, job_id: int):
        """Xóa job khỏi RAM khi training kết thúc."""
        with self.lock:
            if job_id in self.jobs:
                del self.jobs[job_id]
                print(f"[JobManager] Cleared job {job_id} from memory")
            if job_id in self.threads:
                del self.threads[job_id]


# Singleton instance
job_manager = JobManager()
