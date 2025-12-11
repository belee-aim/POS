erpnext.MaterialTransfer.ItemDetails = class {
	constructor({ wrapper, events }) {
		this.wrapper = wrapper;
		this.events = events;
		this.current_item = {};

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.init_child_components();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		this.wrapper.append(`<section class="item-details-container"></section>`);
		this.$component = this.wrapper.find(".item-details-container");
	}

	init_child_components() {
		this.$component.html(
			`<div class="item-details-header">
				<div class="label">${__("Item Details")}</div>
				<div class="close-btn">
					<svg width="32" height="32" viewBox="0 0 14 14" fill="none">
						<path d="M4.93764 4.93759L7.00003 6.99998M9.06243 9.06238L7.00003 6.99998M7.00003 6.99998L4.93764 9.06238L9.06243 4.93759" stroke="#8D99A6"/>
					</svg>
				</div>
			</div>
			<div class="item-display-image"></div>
			<div class="item-display-name"></div>
			<div class="item-display-desc"></div>
			<div class="stock-info-section"></div>
			<div class="form-container"></div>`
		);

		this.$item_name = this.$component.find(".item-display-name");
		this.$item_desc = this.$component.find(".item-display-desc");
		this.$item_image = this.$component.find(".item-display-image");
		this.$stock_info = this.$component.find(".stock-info-section");
		this.$form_container = this.$component.find(".form-container");
	}

	toggle_item_details_section(item) {
		const current_item_changed = !this.compare_items(item, this.current_item);

		// Clear the previous values
		this.$item_name.html("");
		this.$item_desc.html("");
		this.$item_image.html("");
		this.$stock_info.html("");
		this.$form_container.html("");

		if (item && current_item_changed) {
			this.events.toggle_item_selector(true);
			this.current_item = item;

			this.render_form(item);
			this.render_item_info(item);
			this.$component.css("display", "flex");
		} else {
			this.events.toggle_item_selector(false);
			this.current_item = {};
			this.$component.css("display", "none");
		}
	}

	compare_items(item1, item2) {
		if (!item1 || !item2) return false;
		return item1.item_code === item2.item_code;
	}

	render_item_info(item) {
		const { item_name, item_code, item_image, uom, stock_uom, from_warehouse_qty, to_warehouse_qty } = item;

		// Item image
		if (item_image) {
			this.$item_image.html(
				`<img
					onerror="cur_mt.item_details.handle_broken_image(this)"
					src="${item_image}" alt="${frappe.get_abbr(item_name)}">`
			);
		} else {
			this.$item_image.html(`<div class="item-abbr">${frappe.get_abbr(item_name)}</div>`);
		}

		// Item name and description
		this.$item_name.html(item_name);
		this.$item_desc.html(item_code + (uom ? ` | ${uom}` : ""));

		// Stock info
		const from_warehouse = this.events.get_from_warehouse() || __("Not Selected");
		const to_warehouse = this.events.get_to_warehouse() || __("Not Selected");

		this.$stock_info.html(`
			<div class="stock-info-row">
				<div class="stock-label">${__("Source Warehouse")}</div>
				<div class="stock-value">
					<span class="warehouse-name">${from_warehouse}</span>
					<span class="stock-qty">${flt(from_warehouse_qty)} ${stock_uom || ""}</span>
				</div>
			</div>
			<div class="stock-info-row">
				<div class="stock-label">${__("Target Warehouse")}</div>
				<div class="stock-value">
					<span class="warehouse-name">${to_warehouse}</span>
					<span class="stock-qty">${flt(to_warehouse_qty)} ${stock_uom || ""}</span>
				</div>
			</div>
		`);
	}

	handle_broken_image($img) {
		const item_abbr = $($img).attr("alt");
		$($img).replaceWith(`<div class="item-abbr">${item_abbr}</div>`);
	}

	render_form(item) {
		const me = this;

		this.$form_container.html("");

		// Quantity field
		this.qty_control = frappe.ui.form.make_control({
			df: {
				label: __("Quantity"),
				fieldtype: "Float",
				placeholder: __("Enter quantity"),
				onchange: function () {
					me.events.form_updated(item, "qty", flt(this.value));
				},
			},
			parent: this.$form_container,
			render_input: true,
		});
		this.qty_control.set_value(item.qty || 0);

		// Remove button
		this.$form_container.append(`
			<div class="remove-btn-container">
				<button class="btn btn-danger btn-sm remove-item-btn">
					${__("Remove Item")}
				</button>
			</div>
		`);
	}

	bind_events() {
		const me = this;

		this.$component.on("click", ".close-btn", () => {
			this.events.close_item_details();
		});

		this.$component.on("click", ".remove-item-btn", () => {
			this.events.remove_item_from_cart();
		});
	}

	attach_shortcuts() {
		frappe.ui.keys.on("escape", () => {
			const details_visible = this.$component.is(":visible");
			if (details_visible) {
				this.events.close_item_details();
			}
		});
	}

	toggle_component(show) {
		if (show) {
			this.$component.css("display", "flex");
		} else {
			this.$component.css("display", "none");
		}
	}
};
