import { version } from '../package.json';

import { LitElement, TemplateResult, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { HomeAssistant, applyThemesOnElement } from 'custom-card-helpers';

import {
	IConfig,
	ICustomAction,
	defaultKeys,
	defaultSources,
	IKey,
	ISource,
	IData,
} from './models';

import './classes/button';
import './classes/keyboard';
import './classes/textbox';
import './classes/search';
import './classes/touchpad';
import './classes/slider';

console.info(
	`%c ANDROID-TV-CARD v${version}`,
	'color: white; font-weight: bold; background: green',
);

class AndroidTVCard extends LitElement {
	customKeys: Record<string, IKey | ICustomAction>;
	customSources: Record<string, ISource | ICustomAction>;
	customIcons: Record<string, string>;

	@property({ attribute: false }) hass!: HomeAssistant;
	@property({ attribute: false }) private config!: IConfig;

	constructor() {
		super();
		this.customKeys = {};
		this.customSources = {};
		this.customIcons = {};
	}

	static get properties() {
		return {
			hass: {},
			config: {},
		};
	}

	static getStubConfig() {
		return {
			type: 'custom:android-tv-card',
			rows: [],
		};
	}

	getCardSize() {
		let numRows = this.config.rows!.length;
		if ('title' in this.config) {
			numRows += 1;
		}
		return numRows;
	}

	async setConfig(config: IConfig) {
		if (!config) {
			throw new Error('Invalid configuration');
		}
		config = JSON.parse(JSON.stringify(config));
		config = { theme: 'default', ...config };

		// Legacy config upgrades
		config = this.updateDeprecatedKeys(config);
		config = this.convertToRowsArray(config);
		config = this.combineServiceFields(config);

		this.customKeys = config.custom_keys || {};
		this.customSources = config.custom_sources || {};
		this.customIcons = config.custom_icons || {};

		await window.loadCardHelpers();

		this.config = config;
	}

	updateDeprecatedKeys(config: IConfig) {
		if ('adb_id' in config && !('keyboard_id' in config)) {
			config.keyboard_id = (config as Record<string, string>).adb_id;
		}
		return config;
	}

	convertToRowsArray(config: IConfig) {
		if (!('rows' in config) || !(config.rows || []).length) {
			const rows: string[][] = [];
			const rowNames = Object.keys(config).filter((row) =>
				row.includes('_row'),
			);
			for (const name of rowNames) {
				let row = (config as Record<string, string[]>)[name];
				if (typeof row == 'string') {
					row = [row];
				}
				if (name == 'volume_row') {
					row = ['volume_' + row[0]];
				} else if (name == 'navigation_row') {
					row = ['navigation_' + row[0]];
				}
				rows.push(row);
			}
			config.rows = rows;
		}
		return config;
	}

	combineServiceFields(config: IConfig) {
		const customActionKeys = [
			'custom_keys',
			'custom_sources',
		] as (keyof IConfig)[];

		for (const key of customActionKeys) {
			if (key in config) {
				const customActions = config[key as keyof IConfig] as Record<
					string,
					ICustomAction
				>;
				for (const name in customActions) {
					const customAction = customActions[name];
					if ('service' in customAction) {
						customAction.data = {
							...customAction.data,
							...(
								customAction as unknown as Record<
									string,
									IData | undefined
								>
							).service_data,
							...customAction.target,
						};
					}
				}
			}
		}

		return config;
	}

	getInfo(action: string): IKey | ISource | ICustomAction {
		return (
			this.customKeys[action] ||
			this.customSources[action] ||
			defaultKeys[action] ||
			defaultSources[action] ||
			{}
		);
	}

	buildRow(content: TemplateResult[]): TemplateResult {
		return html` <div class="row">${content}</div> `;
	}

	buildColumn(content: TemplateResult[]): TemplateResult {
		return html` <div class="column">${content}</div> `;
	}

	buildElements(row: (string | string[])[], isColumn: boolean = false) {
		if (typeof row == 'string') {
			row = [row];
		}
		const row_content: TemplateResult[] = [];
		for (const element_name of row) {
			if (typeof element_name == 'object' && element_name != null) {
				row_content.push(this.buildElements(element_name, !isColumn));
			} else {
				switch (element_name) {
					case 'volume_buttons': {
						const volumeUpInfo = this.getInfo('volume_up');
						const volumeDownInfo = this.getInfo('volume_down');
						const volumeMuteInfo = this.getInfo('volume_mute');

						row_content.push(
							...[
								html`<remote-button
									.hass=${this.hass}
									.hapticEnabled=${this.config
										.enable_button_feedback || true}
									.remoteId=${this.config.remote_id}
									.info=${volumeUpInfo}
									.actionKey="volume_up"
									.customIcon=${this.customIcons[
										volumeUpInfo.icon ?? ''
									] ?? ''}
								/>`,
								html`<remote-button
									.hass=${this.hass}
									.hapticEnabled=${this.config
										.enable_button_feedback || true}
									.remoteId=${this.config.remote_id}
									.info=${volumeDownInfo}
									.actionKey="volume_down"
									.customIcon=${this.customIcons[
										volumeDownInfo.icon ?? ''
									] ?? ''}
								/>`,
								html`<remote-button
									.hass=${this.hass}
									.hapticEnabled=${this.config
										.enable_button_feedback || true}
									.remoteId=${this.config.remote_id}
									.info=${volumeMuteInfo}
									.actionKey="volume_mute"
									.customIcon=${this.customIcons[
										volumeMuteInfo.icon ?? ''
									] ?? ''}
								/>`,
							],
						);
						break;
					}
					case 'volume_slider': {
						row_content.push(
							html`<remote-slider
								.hass=${this.hass}
								.hapticEnabled=${this.config
									.enable_slider_feedback}
								.mediaPlayerId=${this.config.media_player_id}
								.sliderConfig=${this.config.slider_config}
							/>`,
						);
						break;
					}

					case 'navigation_buttons': {
						const navigation_buttons: TemplateResult[] = [];
						const upInfo = this.getInfo('up');
						navigation_buttons.push(
							html`<remote-button
								.hass=${this.hass}
								.hapticEnabled=${this.config
									.enable_button_feedback || true}
								.remoteId=${this.config.remote_id}
								.info=${upInfo}
								.actionKey="up"
								.customIcon=${this.customIcons[
									upInfo.icon ?? ''
								] ?? ''}
							/>`,
						);

						const leftInfo = this.getInfo('left');
						const centerInfo = this.getInfo('center');
						const rightInfo = this.getInfo('right');
						navigation_buttons.push(
							this.buildRow([
								html`<remote-button
									.hass=${this.hass}
									.hapticEnabled=${this.config
										.enable_button_feedback || true}
									.remoteId=${this.config.remote_id}
									.info=${leftInfo}
									.actionKey="left"
									.customIcon=${this.customIcons[
										leftInfo.icon ?? ''
									] ?? ''}
								/>`,
								html`<remote-button
									.hass=${this.hass}
									.hapticEnabled=${this.config
										.enable_button_feedback || true}
									.remoteId=${this.config.remote_id}
									.info=${centerInfo}
									.actionKey="center"
									.customIcon=${this.customIcons[
										centerInfo.icon ?? ''
									] ?? ''}
								/>`,
								html`<remote-button
									.hass=${this.hass}
									.hapticEnabled=${this.config
										.enable_button_feedback || true}
									.remoteId=${this.config.remote_id}
									.info=${rightInfo}
									.actionKey="right"
									.customIcon=${this.customIcons[
										rightInfo.icon ?? ''
									] ?? ''}
								/>`,
							]),
						);

						const downInfo = this.getInfo('down');
						navigation_buttons.push(
							html`<remote-button
								.hass=${this.hass}
								.hapticEnabled=${this.config
									.enable_button_feedback || true}
								.remoteId=${this.config.remote_id}
								.info=${downInfo}
								.actionKey="down"
								.customIcon=${this.customIcons[
									downInfo.icon ?? ''
								] ?? ''}
							/>`,
						);
						row_content.push(this.buildColumn(navigation_buttons));
						break;
					}

					case 'navigation_touchpad': {
						const upInfo = this.getInfo('up');
						const downInfo = this.getInfo('down');
						const leftInfo = this.getInfo('left');
						const rightInfo = this.getInfo('right');
						const centerInfo = this.getInfo('center');
						const doubleInfo = this.getInfo(
							this.config.double_click_keycode ?? 'back',
						);
						const longInfo = this.getInfo(
							this.config.long_click_keycode ?? 'center',
						);

						let style = {};
						if (this.config['touchpad_height']) {
							style = styleMap({
								height: this.config['touchpad_height'],
							});
						}
						const touchpad = html`<remote-touchpad
							.elementStyle=${style}
							.hass=${this.hass}
							.hapticEnabled=${this.config
								.enable_touchpad_feedback || true}
							.remoteId=${this.config.remote_id}
							.enableDoubleClick=${this.config
								.enable_double_click || false}
							.upInfo=${upInfo}
							.downInfo=${downInfo}
							.leftInfo=${leftInfo}
							.rightInfo=${rightInfo}
							.centerInfo=${centerInfo}
							.doubleInfo=${doubleInfo}
							.longInfo=${longInfo}
						/>`;
						row_content.push(touchpad);
						break;
					}

					case 'keyboard':
					case 'textbox':
					case 'search': {
						const info = this.getInfo(element_name);
						row_content.push(
							html`<remote-${element_name}
								.hass=${this.hass}
								.hapticEnabled=${this.config
									.enable_button_feedback || true}
								.remoteId=${this.config.remote_id}
								.info=${info}
								.actionKey="${element_name}"
								.customIcon=${this.customIcons[
									info.icon ?? ''
								] ?? ''}
								.keyboardId=${this.config.keyboard_id}
								.keyboardMode=${this.config.keyboard_mode}
							/>`,
						);
						break;
					}

					default: {
						const info = this.getInfo(element_name);
						row_content.push(
							html`<remote-button
								.hass=${this.hass}
								.hapticEnabled=${this.config
									.enable_button_feedback || true}
								.remoteId=${this.config.remote_id}
								.info=${info}
								.actionKey="${element_name}"
								.customIcon=${this.customIcons[
									info.icon ?? ''
								] ?? ''}
								.keyboardId=${this.config.keyboard_id}
								.keyboardMode=${this.config.keyboard_mode}
							/>`,
						);
						break;
					}
				}
			}
		}
		return isColumn
			? this.buildColumn(row_content)
			: this.buildRow(row_content);
	}

	render() {
		if (!this.config || !this.hass) {
			return html``;
		}

		const content: TemplateResult[] = [];

		for (const row of this.config.rows!) {
			const row_content = this.buildElements(row as string[]);
			content.push(row_content);
		}

		return html`<ha-card .header="${this.config.title}"
			>${content}</ha-card
		>`;
	}

	static get styles() {
		return css`
			ha-card {
				padding: 12px;
			}
			.row {
				display: flex;
				flex-wrap: nowrap;
				flex-direction: row;
				width: -moz-available;
				width: -webkit-fill-available;
				width: fill-available;
				flex: 1;
				padding: 4px;
				gap: 8px;
				justify-content: space-evenly;
				align-items: center;
			}
			.column {
				display: flex;
				flex-wrap: nowrap;
				flex-direction: column;
				width: -moz-available;
				width: -webkit-fill-available;
				width: fill-available;
				flex: 1;
				padding: 4px;
				justify-content: space-evenly;
				align-items: center;
			}
			.empty-button {
				width: 48px;
				height: 48px;
				position: relative;
			}
		`;
	}

	applyThemesOnElement(element: Element, themes: Themes, localTheme: string) {
		applyThemesOnElement(element, themes, localTheme);
	}
}

customElements.define('android-tv-card', AndroidTVCard);

window.customCards = window.customCards || [];
window.customCards.push({
	type: 'android-tv-card',
	name: 'Android TV Card',
	description: 'Remote for Android TV',
});
