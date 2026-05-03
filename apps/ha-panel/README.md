# `qalaam-ha-panel`

Custom Lovelace panel for Home Assistant. The HA integration registers it via:

```python
from homeassistant.components import frontend
frontend.async_register_built_in_panel(
    hass,
    "custom",
    sidebar_title="Qalaam",
    sidebar_icon="mdi:book-open",
    frontend_url_path="qalaam",
    config={"_panel_custom": {"name": "qalaam-panel", "module_url": "/qalaam_static/qalaam-panel.js"}},
)
```

Panel renders the family-private parent dashboard, today's Hifdh session, and the
"I just heard them recite" rating flow — all using `@qalaam/ui-hifdh` so the
look-and-feel is identical across web + HA + mobile.

## Why Preact

HA caches frontend assets per-repo. A 30 KB Preact bundle loads in < 100 ms even
on slow LAN, vs ~150 KB for vanilla React. Per CLAUDE.md §11.3 design budgets.

## Outcomes served

O-04 (parent cognitive load — opportunity = 16), O-09 (smart-home integration).
