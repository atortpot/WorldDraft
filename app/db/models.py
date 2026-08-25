import enum
from datetime import datetime

from sqlalchemy import Float, ForeignKey, String, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.database import Base


class PlayerPosition(str, enum.Enum):
    GOALKEEPER = "goalkeeper"
    DEFENDER = "defender"
    MIDFIELDER = "midfielder"
    FORWARD = "forward"


class DraftStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"


class TournamentRound(str, enum.Enum):
    QUARTERFINAL = "quarterfinal"
    SEMIFINAL = "semifinal"
    FINAL = "final"


class DraftRound(str, enum.Enum):
    """Fase del torneo de 7 partidos en la que se encuentra un DraftSession:
    3 de grupos + 4 eliminatorias, mas los dos estados terminales."""

    GROUP_1 = "group_1"
    GROUP_2 = "group_2"
    GROUP_3 = "group_3"
    ROUND_OF_16 = "round_of_16"
    QUARTER_FINAL = "quarter_final"
    SEMI_FINAL = "semi_final"
    FINAL = "final"
    ELIMINATED = "eliminated"
    CHAMPION = "champion"


class MatchResult(str, enum.Enum):
    WIN = "win"
    LOSS = "loss"


class Formation(str, enum.Enum):
    """Las 12 formaciones disponibles. El layout exacto de cada una (lista
    ordenada de slots) vive en app/game/formations.py, no aqui: este enum
    solo identifica la formacion elegida por la sesion."""

    F_4_3_3 = "4-3-3"
    F_4_4_2 = "4-4-2"
    F_4_3_2_1 = "4-3-2-1"
    F_3_5_2 = "3-5-2"
    F_4_2_3_1 = "4-2-3-1"
    F_4_5_1 = "4-5-1"
    F_5_3_2 = "5-3-2"
    F_5_4_1 = "5-4-1"
    F_3_4_3 = "3-4-3"
    F_4_1_4_1 = "4-1-4-1"
    F_4_4_2_DIAMOND = "4-4-2 Diamante"
    F_3_4_2_1 = "3-4-2-1"


position_enum = SqlEnum(PlayerPosition, name="player_position")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    draft_sessions: Mapped[list["DraftSession"]] = relationship(back_populates="user")


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (
        UniqueConstraint("name", "country", "tournament_year", name="uq_player_name_country_year"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    tournament_year: Mapped[int] = mapped_column(nullable=False)
    position: Mapped[PlayerPosition] = mapped_column(position_enum, nullable=False)
    goals: Mapped[int] = mapped_column(default=0, nullable=False)
    assists: Mapped[int] = mapped_column(default=0, nullable=False)
    minutes_played: Mapped[int] = mapped_column(default=0, nullable=False)
    rating: Mapped[float] = mapped_column(Float, nullable=False)

    draft_picks: Mapped[list["DraftPick"]] = relationship(back_populates="player")


class DraftSession(Base):
    __tablename__ = "draft_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    status: Mapped[DraftStatus] = mapped_column(
        SqlEnum(DraftStatus, name="draft_status"),
        default=DraftStatus.IN_PROGRESS,
        nullable=False,
    )
    current_round: Mapped[DraftRound] = mapped_column(
        SqlEnum(DraftRound, name="draft_round"),
        default=DraftRound.GROUP_1,
        nullable=False,
    )
    # Selecion/año sorteados por GET /roll, pendientes de resolver con un
    # pick o un pass. Null cuando no hay tirada activa (recien creado el
    # draft, o justo despues de resolver la anterior).
    current_roll_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_roll_year: Mapped[int | None] = mapped_column(nullable=True)
    passes_used: Mapped[int] = mapped_column(default=0, nullable=False)
    # Elegida por el usuario en POST /start, sin default: determina el
    # layout de slots (ver app/game/formations.py) contra el que se valida
    # cada pick.
    formation: Mapped[Formation] = mapped_column(SqlEnum(Formation, name="formation"), nullable=False)

    user: Mapped["User"] = relationship(back_populates="draft_sessions")
    picks: Mapped[list["DraftPick"]] = relationship(back_populates="draft_session")
    matches: Mapped[list["TournamentMatch"]] = relationship(back_populates="draft_session")


class DraftPick(Base):
    __tablename__ = "draft_picks"

    id: Mapped[int] = mapped_column(primary_key=True)
    draft_session_id: Mapped[int] = mapped_column(ForeignKey("draft_sessions.id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    # Indice (0-10) dentro de la lista ordenada de slots de la formacion de
    # la sesion (app/game/formations.py). No un PlayerPosition: una misma
    # formacion puede tener varios slots del mismo tipo (p.ej. dos CB), y
    # cada uno debe poder ocuparse por separado.
    slot_index: Mapped[int] = mapped_column(nullable=False)

    draft_session: Mapped["DraftSession"] = relationship(back_populates="picks")
    player: Mapped["Player"] = relationship(back_populates="draft_picks")


class TournamentMatch(Base):
    __tablename__ = "tournament_matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    draft_session_id: Mapped[int] = mapped_column(ForeignKey("draft_sessions.id"), nullable=False)
    round: Mapped[TournamentRound] = mapped_column(
        SqlEnum(TournamentRound, name="tournament_round"), nullable=False
    )
    opponent_team: Mapped[str] = mapped_column(String(100), nullable=False)
    opponent_year: Mapped[int] = mapped_column(nullable=False)
    result: Mapped[MatchResult] = mapped_column(SqlEnum(MatchResult, name="match_result"), nullable=False)
    home_score: Mapped[int] = mapped_column(nullable=False)
    away_score: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    draft_session: Mapped["DraftSession"] = relationship(back_populates="matches")
