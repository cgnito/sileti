from pydantic import BaseModel, Field
from typing import Any, Dict

class WebhookPayload(BaseModel):
    event_type: str
    request_id: str = Field(..., alias="requestId")
    data: Dict[str, Any]