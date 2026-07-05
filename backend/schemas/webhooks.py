from pydantic import BaseModel, Field
from typing import Any, Dict

class WebhookPayload(BaseModel):
    event_type: str = Field(..., alias="eventType")
    request_id: str = Field(..., alias="requestId")
    data: Dict[str, Any]

    class Config:
        populate_by_name = True