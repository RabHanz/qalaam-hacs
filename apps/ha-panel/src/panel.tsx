/**
 * Qalaam Lovelace panel — entry point.
 *
 * The HA frontend instantiates this as a custom element and (per the
 * panel-custom contract) sets `hass`, `narrow`, `route`, and `panel` properties
 * on the element instance. We mirror those into Preact state so the view can
 * react to theme + sidebar changes without a remount.
 *
 * Theming: per the user's request — fully synced with HA's light/dark theme.
 * HA exposes its theme via CSS custom properties on `<html>` (e.g.
 * `--primary-background-color`, `--card-background-color`, `--primary-text-color`,
 * `--ha-card-border-radius`). The shadow root inherits those automatically when
 * we use `var(...)` in our styles.
 */
import { render } from 'preact';

import { QalaamPanelView, type HassLike } from './QalaamPanelView.js';

class QalaamPanelElement extends HTMLElement {
  private _hass: HassLike | undefined;
  private _narrow: boolean = false;

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

  public connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
  }

  private render(): void {
    if (!this.shadowRoot) return;
    render(
      <QalaamPanelView hass={this._hass} narrow={this._narrow} />,
      this.shadowRoot,
    );
  }
}

if (!customElements.get('qalaam-panel')) {
  customElements.define('qalaam-panel', QalaamPanelElement);
}
