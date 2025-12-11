erpnext.MaterialTransfer.PastRequestSummary = class {
	constructor({ wrapper, events }) {
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
			`<section class="past-order-summary">
				<div class="no-summary-placeholder">
					${__("Select a request to load summary data")}
				</div>
				<div class="invoice-summary-wrapper">
					<div class="abs-container">
						<div class="upper-section"></div>
						<div class="label">${__("Items")}</div>
						<div class="items-container summary-container"></div>
						<div class="label">${__("Details")}</div>
						<div class="totals-container summary-container"></div>
						<div class="summary-btns"></div>
					</div>
				</div>
			</section>`
		);

		this.$component = this.wrapper.find(".past-order-summary");
		this.$summary_wrapper = this.$component.find(".invoice-summary-wrapper");
		this.$summary_container = this.$component.find(".abs-container");
		this.$upper_section = this.$summary_container.find(".upper-section");
		this.$items_container = this.$summary_container.find(".items-container");
		this.$totals_container = this.$summary_container.find(".totals-container");
		this.$summary_btns = this.$summary_container.find(".summary-btns");
	}

	get_upper_section_html(doc) {
		const transfer_status = doc.transfer_status || "Not Started";
		let indicator_color = "";
		let display_status = "";

		if (transfer_status === "Not Started") {
			indicator_color = "orange";
			display_status = "Pending";
		} else if (transfer_status === "In Transit") {
			indicator_color = "yellow";
			display_status = "In Transit";
		} else if (transfer_status === "Completed") {
			indicator_color = "green";
			display_status = "Received";
		} else {
			indicator_color = "gray";
			display_status = transfer_status;
		}

		return `<div class="left-section">
					<div class="customer-section">
						<div class="customer-name">${doc.set_warehouse || __("No Target Warehouse")}</div>
						<div class="customer-email">${__("From")}: ${doc.items[0]?.from_warehouse || "-"}</div>
					</div>
					<div class="cashier">${__("Requested by")}: ${doc.owner}</div>
				</div>
				<div class="right-section">
					<div class="paid-amount">${doc.items.length} ${__("Items")}</div>
					<div class="invoice-name">${doc.name}</div>
					<span class="indicator-pill whitespace-nowrap ${indicator_color}"><span>${__(display_status)}</span></span>
				</div>`;
	}

	get_item_html(doc, item_data) {
		return `<div class="item-row-wrapper">
					<div class="item-name">${item_data.item_name}</div>
					<div class="item-qty">${item_data.qty || 0} ${item_data.uom}</div>
					<div class="item-rate-disc">
						<div class="item-rate">${item_data.from_warehouse || "-"}</div>
					</div>
				</div>`;
	}

	get_schedule_date_html(doc) {
		const schedule_date = frappe.datetime.str_to_user(doc.schedule_date);
		return `<div class="summary-row-wrapper">
					<div>${__("Required By")}</div>
					<div>${schedule_date}</div>
				</div>`;
	}

	get_transaction_date_html(doc) {
		const transaction_date = frappe.datetime.str_to_user(doc.transaction_date);
		return `<div class="summary-row-wrapper">
					<div>${__("Request Date")}</div>
					<div>${transaction_date}</div>
				</div>`;
	}

	get_total_qty_html(doc) {
		let total_qty = 0;
		doc.items.forEach((item) => {
			total_qty += flt(item.qty);
		});
		return `<div class="summary-row-wrapper grand-total">
					<div>${__("Total Quantity")}</div>
					<div>${total_qty}</div>
				</div>`;
	}

	bind_events() {
		this.$summary_container.on("click", ".new-btn", () => {
			this.events.new_request();
			this.toggle_component(false);
			this.$component.find(".no-summary-placeholder").css("display", "flex");
			this.$summary_wrapper.css("display", "none");
		});

		this.$summary_container.on("click", ".print-btn", () => {
			this.print_request();
		});

		this.$summary_container.on("click", ".end-btn", () => {
			this.end_transit();
		});
	}

	async end_transit() {
		if (!this.doc || this.doc.transfer_status !== "In Transit") {
			frappe.show_alert({
				message: __("This request is not in transit"),
				indicator: "orange",
			});
			return;
		}

		frappe.dom.freeze(__("Receiving items..."));

		try {
			const res = await frappe.call({
				method: "pos.pos.page.material_transfer.material_transfer_api.end_material_transfer",
				args: {
					material_request_name: this.doc.name,
				},
			});

			if (res.message) {
				frappe.show_alert({
					message: __("Items received successfully. Stock Entry: {0}", [res.message.stock_entry]),
					indicator: "green",
				});
				frappe.utils.play_sound("submit");

				// Reload the document to refresh the summary
				const updated_doc = await frappe.db.get_doc("Material Request", this.doc.name);
				this.load_summary_of(updated_doc);

				// Trigger event to refresh the list
				if (this.events.on_transit_ended) {
					this.events.on_transit_ended();
				}
			}
		} catch (error) {
			console.error(error);
			frappe.show_alert({
				message: __("Failed to receive items"),
				indicator: "red",
			});
			frappe.utils.play_sound("error");
		} finally {
			frappe.dom.unfreeze();
		}
	}

	print_request() {
		frappe.utils.print(
			this.doc.doctype,
			this.doc.name,
			null,
			this.doc.letter_head,
			this.doc.language || frappe.boot.lang
		);
	}

	attach_shortcuts() {
		const ctrl_label = frappe.utils.is_mac() ? "⌘" : "Ctrl";
		this.$summary_container.find(".print-btn").attr("title", `${ctrl_label}+P`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+p",
			action: () => this.$summary_container.find(".print-btn").click(),
			condition: () =>
				this.$component.is(":visible") && this.$summary_container.find(".print-btn").is(":visible"),
			description: __("Print Request"),
			page: cur_page.page.page,
		});
		this.$summary_container.find(".new-btn").attr("title", `${ctrl_label}+Enter`);
		frappe.ui.keys.on("ctrl+enter", () => {
			const summary_is_visible = this.$component.is(":visible");
			if (summary_is_visible && this.$summary_container.find(".new-btn").is(":visible")) {
				this.$summary_container.find(".new-btn").click();
			}
		});
	}

	add_summary_btns(map) {
		this.$summary_btns.html("");
		map.forEach((m) => {
			if (m.condition) {
				m.visible_btns.forEach((b) => {
					const class_name = b.split(" ")[0].toLowerCase();
					const btn = __(b);
					this.$summary_btns.append(
						`<div class="summary-btn btn btn-default ${class_name}-btn">${btn}</div>`
					);
				});
			}
		});
		this.$summary_btns.children().last().removeClass("mr-4");
	}

	toggle_summary_placeholder(show) {
		if (show) {
			this.$summary_wrapper.css("display", "none");
			this.$component.find(".no-summary-placeholder").css("display", "flex");
		} else {
			this.$summary_wrapper.css("display", "flex");
			this.$component.find(".no-summary-placeholder").css("display", "none");
		}
	}

	get_condition_btn_map(after_submission) {
		if (after_submission)
			return [{ condition: true, visible_btns: ["Print Request", "New Request"] }];

		const is_in_transit = this.doc.transfer_status === "In Transit";

		return [
			{
				condition: is_in_transit,
				visible_btns: ["End Transit"],
			},
			{
				condition: this.doc.docstatus === 1,
				visible_btns: ["Print Request", "New Request"],
			},
		];
	}

	load_summary_of(doc, after_submission = false) {
		after_submission
			? this.$component.css("grid-column", "span 10 / span 10")
			: this.$component.css("grid-column", "span 6 / span 6");

		this.toggle_summary_placeholder(false);

		this.doc = doc;

		this.attach_document_info(doc);

		this.attach_items_info(doc);

		this.attach_totals_info(doc);

		const condition_btns_map = this.get_condition_btn_map(after_submission);

		this.add_summary_btns(condition_btns_map);
	}

	attach_document_info(doc) {
		const upper_section_dom = this.get_upper_section_html(doc);
		this.$upper_section.html(upper_section_dom);
	}

	attach_items_info(doc) {
		this.$items_container.html("");
		doc.items.forEach((item) => {
			const item_dom = this.get_item_html(doc, item);
			this.$items_container.append(item_dom);
		});
	}

	get_status_html(doc) {
		const status = doc.status || "Unknown";
		return `<div class="summary-row-wrapper">
					<div>${__("Status")}</div>
					<div>${__(status)}</div>
				</div>`;
	}

	attach_totals_info(doc) {
		this.$totals_container.html("");

		const status_dom = this.get_status_html(doc);
		const transaction_date_dom = this.get_transaction_date_html(doc);
		const schedule_date_dom = this.get_schedule_date_html(doc);
		const total_qty_dom = this.get_total_qty_html(doc);

		this.$totals_container.append(status_dom);
		this.$totals_container.append(transaction_date_dom);
		this.$totals_container.append(schedule_date_dom);
		this.$totals_container.append(total_qty_dom);
	}

	toggle_component(show) {
		show ? this.$component.css("display", "flex") : this.$component.css("display", "none");
	}
};
