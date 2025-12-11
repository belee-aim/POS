erpnext.MaterialTransfer.RequestDialog = class {
	constructor({ events, wrapper }) {
		this.wrapper = wrapper;
		this.events = events;

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="request-container">
				<div class="section-label request-section">${__("Request Details")}</div>
				<div class="request-modes-section">
					<div class="transfer-summary">
						<div class="summary-card">
							<div class="summary-icon from-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 21V8l9-6 9 6v13H3z"/>
									<path d="M9 21V12h6v9"/>
								</svg>
							</div>
							<div class="summary-info">
								<div class="summary-label">${__("From Warehouse")}</div>
								<div class="summary-value from-warehouse">-</div>
							</div>
						</div>
						<div class="transfer-arrow">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M5 12h14M12 5l7 7-7 7"/>
							</svg>
						</div>
						<div class="summary-card">
							<div class="summary-icon to-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 21V8l9-6 9 6v13H3z"/>
									<path d="M9 21V12h6v9"/>
								</svg>
							</div>
							<div class="summary-info">
								<div class="summary-label">${__("To Warehouse")}</div>
								<div class="summary-value to-warehouse">-</div>
							</div>
						</div>
					</div>
				</div>
				<div class="seperator"></div>
				<div class="fields-numpad-container">
					<div class="fields-section">
						<div class="request-fields">
							<div class="schedule-date-field"></div>
							<div class="remarks-field"></div>
						</div>
					</div>
				</div>
				<div class="totals-section">
					<div class="totals">
						<div class="col">
							<div class="total-label">${__("Total Items")}</div>
							<div class="value total-items">0</div>
						</div>
						<div class="seperator-y"></div>
						<div class="col">
							<div class="total-label">${__("Total Quantity")}</div>
							<div class="value total-qty">0</div>
						</div>
					</div>
				</div>
				<div class="request-actions">
					<div class="edit-cart-btn">${__("Edit Items")}</div>
					<div class="submit-request-btn">${__("Submit Request")}</div>
				</div>
			</section>`
		);

		this.$component = this.wrapper.find(".request-container");

		this.init_fields();
	}

	init_fields() {
		// Schedule Date field
		this.schedule_date_field = frappe.ui.form.make_control({
			df: {
				label: __("Required By Date"),
				fieldtype: "Date",
				fieldname: "schedule_date",
				reqd: 1,
				default: frappe.datetime.get_today(),
			},
			parent: this.$component.find(".schedule-date-field"),
			render_input: true,
		});
		this.schedule_date_field.set_value(frappe.datetime.get_today());

		// Remarks field
		this.remarks_field = frappe.ui.form.make_control({
			df: {
				label: __("Remarks"),
				fieldtype: "Small Text",
				fieldname: "remarks",
				placeholder: __("Add any notes or special instructions..."),
			},
			parent: this.$component.find(".remarks-field"),
			render_input: true,
		});
	}

	bind_events() {
		const me = this;

		// Edit cart button - go back
		this.$component.find(".edit-cart-btn").on("click", () => {
			me.toggle_component(false);
			me.events.on_close && me.events.on_close();
		});

		// Submit request
		this.$component.find(".submit-request-btn").on("click", async () => {
			const schedule_date = me.schedule_date_field.get_value();
			const remarks = me.remarks_field.get_value();

			if (!schedule_date) {
				frappe.show_alert({
					message: __("Please select Required By Date"),
					indicator: "orange",
				});
				frappe.utils.play_sound("error");
				return;
			}

			me.toggle_component(false);
			await me.events.on_submit({
				schedule_date,
				remarks,
			});
		});
	}

	attach_shortcuts() {
		const me = this;
		const ctrl_label = frappe.utils.is_mac() ? "⌘" : "Ctrl";
		this.$component.find(".submit-request-btn").attr("title", `${ctrl_label}+Enter`);

		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+enter",
			action: () => this.$component.find(".submit-request-btn").click(),
			condition: () => this.$component.is(":visible"),
			description: __("Submit Material Request"),
			ignore_inputs: true,
			page: cur_page.page.page,
		});

		frappe.ui.keys.add_shortcut({
			shortcut: "escape",
			action: () => {
				if (me.$component.is(":visible")) {
					me.toggle_component(false);
					me.events.on_close && me.events.on_close();
				}
			},
			condition: () => me.$component.is(":visible"),
			description: __("Go back to edit items"),
			page: cur_page.page.page,
		});
	}

	show(data) {
		// Update summary
		this.$component.find(".from-warehouse").text(data.from_warehouse || "-");
		this.$component.find(".to-warehouse").text(data.to_warehouse || "-");
		this.$component.find(".total-items").text(data.total_items || 0);
		this.$component.find(".total-qty").text(data.total_qty || 0);

		// Reset fields
		this.schedule_date_field.set_value(frappe.datetime.get_today());
		this.remarks_field.set_value("");

		// Show dialog
		this.toggle_component(true);
	}

	toggle_component(show) {
		if (show) {
			this.$component.css("display", "flex");
		} else {
			this.$component.css("display", "none");
		}
	}
};
