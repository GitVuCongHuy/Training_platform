# D:\New folder\backend\database\models.py
from sqlalchemy import JSON, Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.sql import func
from .database import Base


class PromptHistory(Base):
    __tablename__ = "prompt_history"
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    classes_data = Column(String, nullable=False) 
    output_path = Column(String, nullable=False)


class TrainingSession(Base):
    __tablename__ = "training_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    session_name = Column(String, index=True)
    dataset_path = Column(Text)
    final_dataset_path = Column(Text)
    task_type = Column(String)             
    model_family = Column(String)          
    model_version = Column(String)         
    model_size = Column(String)            
    model_arch = Column(String)            
    aug_preset = Column(String)
    
    class_names_json = Column(JSON, nullable=True) 
    
    epochs = Column(Integer)
    lr = Column(Float)
    batch_size = Column(Integer)
    img_width = Column(Integer)
    img_height = Column(Integer)
    
    split_train_ratio = Column(Float, nullable=True)
    split_val_ratio = Column(Float, nullable=True)
    split_test_ratio = Column(Float, nullable=True)
    
    status = Column(String, default="pending")
    current_epoch = Column(Integer, default=0)
    total_epochs = Column(Integer, default=0)
    
    train_loss = Column(Float, nullable=True)
    val_loss = Column(Float, nullable=True)
    
    train_loss_history = Column(JSON, nullable=True) 
    val_loss_history = Column(JSON, nullable=True) 
    
    val_acc = Column(Float, nullable=True)
    val_acc_history = Column(JSON, nullable=True) 
    
    best_map50 = Column(Float, nullable=True)
    detection_metrics_history_json = Column(JSON, nullable=True)
    
    gpu_mem_max = Column(Float, nullable=True)       
    dataset_stats_json = Column(JSON, nullable=True)  
    num_classes = Column(Integer, nullable=True) 

    confusion_matrix_json = Column(JSON, nullable=True) 
    
    best_metric_note = Column(String, nullable=True) 
    
    checkpoint_path = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TestingSession(Base):
    __tablename__ = "testing_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session_name = Column(String, nullable=True)
    training_id = Column(Integer, nullable=True)

    model_path = Column(Text, nullable=False)
    dataset_path = Column(Text, nullable=False)
    task_type = Column(String, nullable=True) 
    
    status = Column(String, default="pending") 
    error_message = Column(Text, nullable=True)
    
    metrics_json = Column(JSON, nullable=True) 
    confusion_matrix_json = Column(JSON, nullable=True) 