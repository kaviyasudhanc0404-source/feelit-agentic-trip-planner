from fastapi import APIRouter, Depends

from app.routers.stream import sse
from app.schemas import AgentIn
from app.security import ai_limit, optional_user
from app.services import geo
from app.services.agent import converse

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("", dependencies=[Depends(ai_limit)])
async def agent(body: AgentIn, user: dict | None = Depends(optional_user)):
    """One turn of the planning chat. Open to guests; building a trip from its brief needs an account."""
    here = await geo.reverse(body.lat, body.lon) if body.lat is not None and body.lon is not None else None
    history = [turn.model_dump() for turn in body.history]
    return sse(converse(body.message, history, user, here))
