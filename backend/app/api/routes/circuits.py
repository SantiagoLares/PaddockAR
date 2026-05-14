from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.text_normalization import normalize_circuit
from app.models.circuit import Circuit
from app.schemas.circuit import CircuitRead

router = APIRouter(prefix="/api/circuits", tags=["circuits"])


@router.get("", response_model=list[CircuitRead])
def list_circuits(db: Session = Depends(get_db)):
    statement = select(Circuit).order_by(Circuit.name)
    circuits = db.scalars(statement).all()
    for circuit in circuits:
        normalize_circuit(circuit)
    return circuits
