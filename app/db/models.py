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
    # Acumulado del propio usuario en la fase de grupos (3 partidos contra
    # los 3 rivales de group_opponents); el de cada rival vive en su propia
    # fila de GroupStageOpponent, ya que solo juega un partido (contra el
    # usuario) en este modelo simplificado -- ver app/game/draft_service.py.
    group_points: Mapped[int] = mapped_column(default=0, nullable=False)
    group_goals_for: Mapped[int] = mapped_column(default=0, nullable=False)
    group_goals_against: Mapped[int] = mapped_column(default=0, nullable=False)

    user: Mapped["User"] = relationship(back_populates="draft_sessions")
    picks: Mapped[list["DraftPick"]] = relationship(back_populates="draft_session")
    matches: Mapped[list["TournamentMatch"]] = relationship(back_populates="draft_session")
    group_opponents: Mapped[list["GroupStageOpponent"]] = relationship(back_populates="draft_session")


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


class GroupStageOpponent(Base):
    """Uno de los 3 rivales historicos de la fase de grupos de una sesion,
    sorteados de una vez al iniciar el draft (ver
    app/game/draft_service.py:_generate_group_opponents). El usuario esta en
    un grupo de 4 (el mismo + estos 3): points/goals_for/goals_against de
    esta fila son SIEMPRE los del partido de este rival contra el usuario
    (nunca un acumulado), para poder seguir usandolos como enfrentamiento
    directo aunque el rival tambien haya jugado contra los otros 2 rivales
    del grupo (ver GroupStageRivalMatch, mas abajo). El acumulado del total
    de esos 3 partidos (el de aqui + los 2 de GroupStageRivalMatch) se
    calcula al vuelo en draft_service._aggregate_rival_row, no se guarda.
    El acumulado del propio usuario vive en
    DraftSession.group_points/group_goals_for/group_goals_against.
    """

    __tablename__ = "group_stage_opponents"
    __table_args__ = (
        UniqueConstraint("draft_session_id", "slot", name="uq_group_opponent_session_slot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    draft_session_id: Mapped[int] = mapped_column(ForeignKey("draft_sessions.id"), nullable=False)
    # 1/2/3: en que partido de grupos (group_1/group_2/group_3) se juega
    # contra este rival.
    slot: Mapped[int] = mapped_column(nullable=False)
    # country ya en formato "wiki_country" (el que usa Player.country), no
    # el nombre crudo de WorldCupMatches.csv -- ver to_squads_country_name.
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    tournament_year: Mapped[int] = mapped_column(nullable=False)
    # fifa_points y goals_avg se calculan una vez al generar el grupo (son
    # estaticos: dependen solo de equipo+año) y se guardan aqui para no
    # tener que volver a resolver el nombre crudo de WorldCupMatches.csv en
    # cada partido.
    fifa_points: Mapped[float] = mapped_column(Float, nullable=False)
    goals_avg: Mapped[float] = mapped_column(Float, nullable=False)
    played: Mapped[bool] = mapped_column(default=False, nullable=False)
    points: Mapped[int] = mapped_column(default=0, nullable=False)
    goals_for: Mapped[int] = mapped_column(default=0, nullable=False)
    goals_against: Mapped[int] = mapped_column(default=0, nullable=False)

    draft_session: Mapped["DraftSession"] = relationship(back_populates="group_opponents")


class GroupStageRivalMatch(Base):
    """Uno de los 3 partidos entre rivales de la fase de grupos (rival
    contra rival, nunca involucra al usuario) que completan el grupo real
    de 4 equipos / 6 partidos: el usuario juega contra cada uno de los 3
    rivales (esos resultados viven en GroupStageOpponent), y estos 3
    partidos son los que faltan para que cada rival tambien tenga sus 3
    jugados. Se simulan de golpe al terminar el group_3 (ver
    draft_service._simulate_remaining_group_matches), nunca antes.

    Los puntos de cada lado no se guardan aparte, se derivan de
    home_goals/away_goals donde hagan falta (evita que puedan
    desincronizarse del marcador)."""

    __tablename__ = "group_stage_rival_matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    draft_session_id: Mapped[int] = mapped_column(ForeignKey("draft_sessions.id"), nullable=False)
    home_opponent_id: Mapped[int] = mapped_column(ForeignKey("group_stage_opponents.id"), nullable=False)
    away_opponent_id: Mapped[int] = mapped_column(ForeignKey("group_stage_opponents.id"), nullable=False)
    home_goals: Mapped[int] = mapped_column(nullable=False)
    away_goals: Mapped[int] = mapped_column(nullable=False)


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
