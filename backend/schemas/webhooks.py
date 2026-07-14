from pydantic import BaseModel, Field, ConfigDict, AliasChoices
from typing import Any, Dict

class WebhookPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event_type: str = Field(
        ..., 
        validation_alias=AliasChoices("event_type", "eventType"),
        serialization_alias="event_type",
    )
    request_id: str = Field(
        ..., 
        validation_alias=AliasChoices("request_id", "requestId"),
        serialization_alias="request_id",
    )
    data: Dict[str, Any]