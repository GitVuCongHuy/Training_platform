# backend/database/utils.py
"""
Database utility functions - tái sử dụng ở nhiều nơi
"""
import json
from typing import Any, Optional, Union, List, Dict


def safe_json_load(
    val: Optional[Union[str, dict, list]], 
    default_val: Optional[Any] = None
) -> Any:
    """
    Safely parse JSON string to Python object.
    If val is already a dict/list, return as-is.
    If val is None or empty, return default_val.
    
    Args:
        val: JSON string or already-parsed object
        default_val: Default value if parsing fails (default: [])
    
    Returns:
        Parsed object or default_val
    """
    if default_val is None:
        default_val = []
    
    if val is None:
        return default_val

    # Already parsed
    if isinstance(val, (dict, list)):
        return val

    # Empty string
    if not val:
        return default_val
    
    # Try to parse JSON string
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default_val


def json_or_none(val: Optional[str]) -> Optional[Union[Dict, List]]:
    """
    Parse JSON string, return None if fails.
    """
    if val is None:
        return None
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return None
