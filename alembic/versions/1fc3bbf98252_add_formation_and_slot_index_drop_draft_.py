"""add formation and slot_index, drop draft_picks.position_slot

Revision ID: 1fc3bbf98252
Revises: dece49f4198f
Create Date: 2026-08-25 20:27:06.104892

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '1fc3bbf98252'
down_revision: Union[str, Sequence[str], None] = 'dece49f4198f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FORMATION_VALUES = (
    'F_4_3_3', 'F_4_4_2', 'F_4_3_2_1', 'F_3_5_2', 'F_4_2_3_1', 'F_4_5_1',
    'F_5_3_2', 'F_5_4_1', 'F_3_4_3', 'F_4_1_4_1', 'F_4_4_2_DIAMOND', 'F_3_4_2_1',
)


def upgrade() -> None:
    """Upgrade schema."""
    formation_enum = postgresql.ENUM(*FORMATION_VALUES, name='formation')
    formation_enum.create(op.get_bind())
    # server_default solo para rellenar sesiones ya existentes (datos de
    # prueba, sin formacion real); el modelo no define default en Python
    # porque el endpoint /start la exige siempre explicitamente.
    op.add_column(
        'draft_sessions', sa.Column('formation', formation_enum, nullable=False, server_default='F_4_3_3')
    )
    op.alter_column('draft_sessions', 'formation', server_default=None)

    # slot_index sustituye a position_slot: identifica un slot concreto de
    # la formacion (por indice), no solo su tipo de posicion, porque una
    # formacion puede repetir tipo (p.ej. dos CB). Los picks ya existentes
    # son datos de prueba, se backfillean a 0 sin intentar preservar semantica.
    op.add_column(
        'draft_picks', sa.Column('slot_index', sa.Integer(), nullable=False, server_default='0')
    )
    op.alter_column('draft_picks', 'slot_index', server_default=None)
    op.drop_column('draft_picks', 'position_slot')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        'draft_picks',
        sa.Column(
            'position_slot',
            sa.Enum('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD', name='player_position'),
            nullable=True,
        ),
    )
    op.drop_column('draft_picks', 'slot_index')
    op.drop_column('draft_sessions', 'formation')
    postgresql.ENUM(name='formation').drop(op.get_bind())
