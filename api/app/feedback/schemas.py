from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, EmailStr, field_validator, model_validator
from app.db.models import FeedbackStatus

class Submission(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=200)
    email: Optional[EmailStr] = Field(default=None, max_length=320)
    rating: int = Field(ge=1, le=5, strict=True)
    comment: str = Field(min_length=1, max_length=10000)

    @field_validator('name', 'comment', 'email', mode='before')
    @classmethod
    def trim(cls, value):
        return value.strip() or None if isinstance(value, str) else value

class Moderation(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: FeedbackStatus
    is_public: bool

    @model_validator(mode='after')
    def approved_only(self):
        if self.is_public and self.status != FeedbackStatus.APPROVED:
            raise ValueError('Only approved feedback can be public')
        return self
