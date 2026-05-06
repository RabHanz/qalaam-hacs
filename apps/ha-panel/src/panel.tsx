/**
 * Qalaam Lovelace panel — entry point.
 *
 * The HA frontend instantiates this as a custom element and (per the
 * panel-custom contract) sets `hass`, `narrow`, `route`, and `panel`
 * properties on the element instance. We mirror those into Preact state
 * so the view can react to theme + sidebar + config changes without a
 * remount.
 *
 * `panel` carries the entire `config` we passed in panel.py's
 * `async_register_built_in_panel(... config={...})` — we namespace
 * Qalaam's payload under `panel.config.qalaam` to avoid colliding with
 * HA's own `_panel_custom` slot. Currently it ships `web_url` so the
 * view can deep-link to the standalone Qalaam web app instead of
 * pushing window.history at the HA frontend (the `/qalaam` URL on HA
 * IS this panel, so an in-frontend pushState was a no-op).
 *
 * Theming: fully synced with HA's light/dark theme via CSS custom
 * properties on `<html>` (--primary-background-color, --card-
 * background-color, --primary-text-color, --ha-card-border-radius,
 * etc.). The shadow root inherits those automatically when we use
 * `var(...)`.
 */
import { render } from 'preact';

import { QalaamPanelView, type HassLike } from './QalaamPanelView.js';

interface PanelMeta {
  readonly config?: {
    readonly qalaam?: { readonly web_url?: string };
  };
}

class QalaamPanelElement extends HTMLElement {
  private _hass: HassLike | undefined;
  private _narrow = false;
  private _panel: PanelMeta | undefined;

  /** HA writes this on every WebSocket update. */
  public set hass(value: HassLike | undefined) {
    this._hass = value;
    this.render();
  }
  public get hass(): HassLike | undefined {
    return this._hass;
  }

  public set narrow(value: boolean) {
    this._narrow = value;
    this.render();
  }
  public get narrow(): boolean {
    return this._narrow;
  }

  /** HA writes this once on mount and again on config-entry update. */
  public set panel(value: PanelMeta | undefined) {
    this._panel = value;
    this.render();
  }
  public get panel(): PanelMeta | undefined {
    return this._panel;
  }

  public connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
  }

  private render(): void {
    if (!this.shadowRoot) return;
    const webUrl = this._panel?.config?.qalaam?.web_url;
    render(
      <QalaamPanelView hass={this._hass} narrow={this._narrow} webUrl={webUrl} />,
      this.shadowRoot,
    );
  }
}

if (!customElements.get('qalaam-panel')) {
  customElements.define('qalaam-panel', QalaamPanelElement);
}
