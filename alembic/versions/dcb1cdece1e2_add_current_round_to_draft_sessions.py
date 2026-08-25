"""add current_round to draft_sessions

Revision ID: dcb1cdece1e2
Revises: dcce02d47e2a
Create Date: 2026-08-25 13:14:19.918970

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'dcb1cdece1e2'
down_revision: Union[str, Sequence[str], None] = 'dcce02d47e2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DRAFT_ROUND_VALUES = (
    'GROUP_1', 'GROUP_2', 'GROUP_3', 'ROUND_OF_16',
    'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'ELIMINATED', 'CHAMPION',
)


def upgrade() -> None:
    """Upgrade schema."""
    draft_round_enum = postgresql.ENUM(*DRAFT_ROUND_VALUES, name='draft_round')
    draft_round_enum.create(op.get_bind())
    # server_default solo para rellenar las filas ya existentes; el modelo
    # (app/db/models.py) ya aplica GROUP_1 como default en el lado de Python
    # para las filas nuevas, igual que hace la columna "status".
    op.add_column(
        'draft_sessions',
        sa.Column('current_round', draft_round_enum, nullable=False, server_default='GROUP_1'),
    )
    op.alter_column('draft_sessions', 'current_round', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('draft_sessions', 'current_round')
    postgresql.ENUM(name='draft_round').drop(op.get_bind())
