"""add roll state to draft_sessions

Revision ID: dece49f4198f
Revises: dcb1cdece1e2
Create Date: 2026-08-25 20:06:36.779420

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dece49f4198f'
down_revision: Union[str, Sequence[str], None] = 'dcb1cdece1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('draft_sessions', sa.Column('current_roll_country', sa.String(length=100), nullable=True))
    op.add_column('draft_sessions', sa.Column('current_roll_year', sa.Integer(), nullable=True))
    # server_default solo para rellenar las filas ya existentes; el modelo
    # (app/db/models.py) ya aplica 0 como default en el lado de Python para
    # las filas nuevas, igual que el resto de columnas de esta tabla.
    op.add_column(
        'draft_sessions', sa.Column('passes_used', sa.Integer(), nullable=False, server_default='0')
    )
    op.alter_column('draft_sessions', 'passes_used', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('draft_sessions', 'passes_used')
    op.drop_column('draft_sessions', 'current_roll_year')
    op.drop_column('draft_sessions', 'current_roll_country')
