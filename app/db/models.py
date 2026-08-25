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


# Compartido por Player.position y DraftPick.position_slot: ambos representan
# la misma noción de posición y deben mapear al mismo tipo ENUM de Postgres.
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

    user: Mapped["User"] = relationship(back_populates="draft_sessions")
    picks: Mapped[list["DraftPick"]] = relationship(back_populates="draft_session")
    matches: Mapped[list["TournamentMatch"]] = relationship(back_populates="draft_session")


class DraftPick(Base):
    __tablename__ = "draft_picks"

    id: Mapped[int] = mapped_column(primary_key=True)
    draft_session_id: Mapped[int] = mapped_column(ForeignKey("draft_sessions.id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    position_slot: Mapped[PlayerPosition] = mapped_column(position_enum, nullable=False)

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
