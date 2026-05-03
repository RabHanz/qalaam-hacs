"""Qalaam todo entity — today's Hifdh plan as a TodoListEntity.

Per HA's Todo platform: each portion is a TodoItem with summary = verse range,
status = NEEDS_ACTION until rated, COMPLETED after a successful rating.
"""

from __future__ import annotations

from typing import Final

from homeassistant.components.todo import (
    TodoItem,
    TodoItemStatus,
    TodoListEntity,
    TodoListEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import QalaamCoordinator
from .entity import QalaamEntity

_LOGGER: Final = __import__("logging").getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: QalaamCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([QalaamHifdhTodoList(coordinator)])


class QalaamHifdhTodoList(QalaamEntity, TodoListEntity):
    """Todo list backed by the Qalaam Hifdh session."""

    _attr_supported_features = (
        TodoListEntityFeature.UPDATE_TODO_ITEM
    )
    _attr_translation_key = "hifdh_plan"

    def __init__(self, coordinator: QalaamCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}-todo-hifdh"
        # v0.5 hydrates from /v1/hifdh/session; v0.1 starts empty.
        self._items: list[TodoItem] = []

    @property
    def todo_items(self) -> list[TodoItem]:
        return list(self._items)

    async def async_update_todo_item(self, item: TodoItem) -> None:
        for i, existing in enumerate(self._items):
            if existing.uid == item.uid:
                self._items[i] = item
                self.async_write_ha_state()
                return
        _LOGGER.warning("qalaam.todo: unknown item uid %s", item.uid)

    @staticmethod
    def _portion_to_item(portion_id: str, summary: str) -> TodoItem:
        return TodoItem(uid=portion_id, summary=summary, status=TodoItemStatus.NEEDS_ACTION)
