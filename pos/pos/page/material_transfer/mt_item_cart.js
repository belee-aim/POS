erpnext.MaterialTransfer.ItemCart = class {
	constructor({ wrapper, events, warehouses }) {
		this.wrapper = wrapper;
		this.events = events;
		this.warehouses = warehouses || [];

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.init_child_components();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		this.wrapper.append(`<section class="customer-cart-container"></section>`);
		this.$component = this.wrapper.find(".customer-cart-container");
	}

	init_child_components() {
		this.init_warehouse_selector();
		this.init_cart_components();
	}

	init_warehouse_selector() {
		this.$component.append(`<div class="customer-section"></div>`);
		this.$warehouse_section = this.$component.find(".customer-section");
		this.make_warehouse_selector();
	}

	make_warehouse_selector() {
		this.$warehouse_section.html(`
			<div class="warehouse-field"></div>
		`);

		const me = this;

		this.warehouse_field = frappe.ui.form.make_control({
			df: {
				label: __("Source Warehouse"),
				fieldtype: "Link",
				options: "Warehouse",
				placeholder: __("Select source warehouse (transfer from)"),
				get_query: function () {
					return {
						filters: {
							is_group: 0,
							disabled: 0,
						},
					};
				},
				onchange: function () {
					if (this.value) {
						me.from_warehouse = this.value;
						me.events.warehouse_changed("from", this.value);
						me.update_warehouse_display();
					}
				},
			},
			parent: this.$warehouse_section.find(".warehouse-field"),
			render_input: true,
		});
		this.warehouse_field.toggle_label(false);
	}

	set_to_warehouse(warehouse) {
		this.to_warehouse = warehouse;
		this.update_warehouse_display();
	}

	update_warehouse_display() {
		// Update display after warehouse selection
		if (this.from_warehouse) {
			const warehouse_name = this.from_warehouse;
			this.$warehouse_section.find(".warehouse-field").after(`
				<div class="warehouse-display" style="display: none;">
					<div class="warehouse-info">
						<div class="warehouse-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M3 21V8l9-6 9 6v13H3z"/>
								<path d="M9 21V12h6v9"/>
							</svg>
						</div>
						<div class="warehouse-details">
							<div class="warehouse-name">${warehouse_name}</div>
							<div class="warehouse-label">${__("Source Warehouse")}</div>
						</div>
						<div class="reset-warehouse-btn">
							<svg width="20" height="20" viewBox="0 0 14 14" fill="none">
								<path d="M4.93764 4.93759L7.00003 6.99998M9.06243 9.06238L7.00003 6.99998M7.00003 6.99998L4.93764 9.06238L9.06243 4.93759" stroke="#8D99A6"/>
							</svg>
						</div>
					</div>
				</div>
			`);
		}
	}

	init_cart_components() {
		this.$component.append(
			`<div class="cart-container">
				<div class="abs-cart-container">
					<div class="cart-label">${__("Transfer Items")}</div>
					<div class="cart-header">
						<div class="name-header">${__("Item")}</div>
						<div class="qty-header">${__("Quantity")}</div>
						<div class="rate-amount-header">${__("Stock")}</div>
					</div>
					<div class="cart-items-section"></div>
					<div class="cart-totals-section"></div>
					<div class="numpad-section"></div>
				</div>
			</div>`
		);

		this.$cart_container = this.$component.find(".cart-container");

		this.make_cart_totals_section();
		this.make_cart_items_section();
		this.make_cart_numpad();
	}

	make_cart_items_section() {
		this.$cart_header = this.$component.find(".cart-header");
		this.$cart_items_wrapper = this.$component.find(".cart-items-section");
		this.make_no_items_placeholder();
	}

	make_no_items_placeholder() {
		this.$cart_header.css("display", "none");
		this.$cart_items_wrapper.html(`<div class="no-item-wrapper">${__("No items in transfer list")}</div>`);
	}

	make_cart_totals_section() {
		this.$totals_section = this.$component.find(".cart-totals-section");

		this.$totals_section.append(
			`<div class="item-qty-total-container">
				<div class="item-qty-total-label">${__("Total Items")}</div>
				<div class="item-qty-total-value">0</div>
			</div>
			<div class="grand-total-container">
				<div>${__("Total Quantity")}</div>
				<div>0</div>
			</div>
			<div class="checkout-btn">${__("Request Material")}</div>
			<div class="edit-cart-btn">${__("Edit List")}</div>`
		);
	}

	make_cart_numpad() {
		this.$numpad_section = this.$component.find(".numpad-section");

		this.number_pad = new erpnext.PointOfSale.NumberPad({
			wrapper: this.$numpad_section,
			events: {
				numpad_event: this.on_numpad_event.bind(this),
			},
			cols: 5,
			keys: [
				[1, 2, 3, "Quantity"],
				[4, 5, 6, ""],
				[7, 8, 9, ""],
				[".", 0, "Delete", "Remove"],
			],
			css_classes: [
				["", "", "", "col-span-2"],
				["", "", "", "col-span-2"],
				["", "", "", "col-span-2"],
				["", "", "", "col-span-2 remove-btn"],
			],
			fieldnames_map: { Quantity: "qty" },
		});

		this.$numpad_section.prepend(
			`<div class="numpad-totals">
				<span class="numpad-item-qty-total"></span>
				<span class="numpad-grand-total"></span>
			</div>`
		);

		this.$numpad_section.append(
			`<div class="numpad-btn checkout-btn" data-button-value="checkout">${__("Request Material")}</div>`
		);
	}

	bind_events() {
		const me = this;

		this.$warehouse_section.on("click", ".reset-warehouse-btn", function () {
			me.warehouse_field.set_value("");
			me.from_warehouse = null;
			me.$warehouse_section.find(".warehouse-display").remove();
			me.events.warehouse_changed("from", null);
		});

		this.$cart_items_wrapper.on("click", ".cart-item-wrapper", function () {
			const $cart_item = $(this);
			me.toggle_item_highlight(this);

			const item_code = unescape($cart_item.attr("data-item-code"));
			me.events.cart_item_clicked({ item_code });
		});

		this.$component.on("click", ".checkout-btn", async function () {
			if ($(this).attr("style")?.indexOf("--blue-500") == -1) return;
			await me.events.submit_request();
		});

		this.$totals_section.on("click", ".edit-cart-btn", () => {
			this.toggle_checkout_btn(true);
		});
	}

	attach_shortcuts() {
		for (let row of this.number_pad.keys) {
			for (let btn of row) {
				if (typeof btn !== "string") continue;

				let shortcut_key = `ctrl+${frappe.scrub(String(btn))[0]}`;
				if (btn === "Delete") shortcut_key = "ctrl+backspace";
				if (btn === "Remove") shortcut_key = "shift+ctrl+backspace";
				if (btn === ".") shortcut_key = "ctrl+>";

				const fieldname = this.number_pad.fieldnames[btn]
					? this.number_pad.fieldnames[btn]
					: typeof btn === "string"
					? frappe.scrub(btn)
					: btn;

				let shortcut_label = shortcut_key.split("+").map(frappe.utils.to_title_case).join("+");
				shortcut_label = frappe.utils.is_mac() ? shortcut_label.replace("Ctrl", "⌘") : shortcut_label;

				this.$numpad_section
					.find(`.numpad-btn[data-button-value="${fieldname}"]`)
					.attr("title", shortcut_label);

				frappe.ui.keys.on(`${shortcut_key}`, () => {
					const cart_is_visible = this.$component.is(":visible");
					if (cart_is_visible && this.item_is_selected && this.$numpad_section.is(":visible")) {
						this.$numpad_section.find(`.numpad-btn[data-button-value="${fieldname}"]`).click();
					}
				});
			}
		}

		const ctrl_label = frappe.utils.is_mac() ? "⌘" : "Ctrl";
		this.$component.find(".checkout-btn").attr("title", `${ctrl_label}+Enter`);

		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+enter",
			action: () => this.$component.find(".checkout-btn").click(),
			condition: () => this.$component.is(":visible"),
			description: __("Submit Material Request"),
			ignore_inputs: true,
			page: cur_page.page.page,
		});
	}

	toggle_item_highlight(item) {
		const $cart_item = $(item);
		const item_is_highlighted = $cart_item.attr("style") == "background-color:var(--gray-50);";

		if (!item || item_is_highlighted) {
			this.item_is_selected = false;
			this.$cart_container.find(".cart-item-wrapper").css("background-color", "");
		} else {
			$cart_item.css("background-color", "var(--control-bg)");
			this.item_is_selected = true;
			this.$cart_container.find(".cart-item-wrapper").not(item).css("background-color", "");
		}
	}

	update_totals_section() {
		const cart_items = this.events.get_cart_items();
		const items = Object.values(cart_items);

		let total_items = items.length;
		let total_qty = 0;

		items.forEach((item) => {
			total_qty += flt(item.qty);
		});

		this.$totals_section
			.find(".item-qty-total-container")
			.html(`<div>${__("Total Items")}</div><div>${total_items}</div>`);

		this.$totals_section
			.find(".grand-total-container")
			.html(`<div>${__("Total Quantity")}</div><div>${total_qty}</div>`);

		this.$numpad_section
			.find(".numpad-item-qty-total")
			.html(`<div>${__("Total Items")}: <span>${total_items}</span></div>`);

		this.$numpad_section
			.find(".numpad-grand-total")
			.html(`<div>${__("Total Quantity")}: <span>${total_qty}</span></div>`);
	}

	get_cart_item({ item_code }) {
		const item_selector = `.cart-item-wrapper[data-item-code="${escape(item_code)}"]`;
		return this.$cart_items_wrapper.find(item_selector);
	}

	update_item_html(item, remove_item) {
		const $item = this.get_cart_item(item);

		if (remove_item) {
			$item && $item.next().remove() && $item.remove();
		} else {
			this.render_cart_item(item, $item);
		}

		const no_of_cart_items = this.$cart_items_wrapper.find(".cart-item-wrapper").length;
		this.highlight_checkout_btn(no_of_cart_items > 0);
		this.update_empty_cart_section(no_of_cart_items);
	}

	render_cart_item(item_data, $item_to_update) {
		const me = this;

		if (!$item_to_update.length) {
			this.$cart_items_wrapper.append(
				`<div class="cart-item-wrapper" data-item-code="${escape(item_data.item_code)}"></div>
				<div class="seperator"></div>`
			);
			$item_to_update = this.get_cart_item(item_data);
		}

		$item_to_update.html(
			`${get_item_image_html()}
			<div class="item-name-desc">
				<div class="item-name">
					${item_data.item_name}
				</div>
				<div class="item-desc">${item_data.uom || item_data.stock_uom || ""}</div>
			</div>
			${get_qty_html()}`
		);

		function get_qty_html() {
			return `
				<div class="item-qty-rate">
					<div class="item-qty"><span>${item_data.qty || 0}</span></div>
					<div class="item-rate-amount">
						<div class="item-stock-info">
							<span class="from-qty">${flt(item_data.from_warehouse_qty)}</span>
							<span>/</span>
							<span class="to-qty">${flt(item_data.to_warehouse_qty)}</span>
						</div>
					</div>
				</div>`;
		}

		function get_item_image_html() {
			const { item_image, item_name } = item_data;
			if (item_image) {
				return `
					<div class="item-image">
						<img
							onerror="cur_mt.cart.handle_broken_image(this)"
							src="${item_image}" alt="${frappe.get_abbr(item_name)}">
					</div>`;
			} else {
				return `<div class="item-image item-abbr">${frappe.get_abbr(item_name)}</div>`;
			}
		}
	}

	handle_broken_image($img) {
		const item_abbr = $($img).attr("alt");
		$($img).parent().replaceWith(`<div class="item-image item-abbr">${item_abbr}</div>`);
	}

	toggle_checkout_btn(show_checkout) {
		if (show_checkout) {
			this.$totals_section.find(".checkout-btn").css("display", "flex");
			this.$totals_section.find(".edit-cart-btn").css("display", "none");
		} else {
			this.$totals_section.find(".checkout-btn").css("display", "none");
			this.$totals_section.find(".edit-cart-btn").css("display", "flex");
		}
	}

	highlight_checkout_btn(toggle) {
		if (toggle) {
			this.$cart_container.find(".checkout-btn").css({
				"background-color": "var(--blue-500)",
			});
		} else {
			this.$cart_container.find(".checkout-btn").css({
				"background-color": "var(--blue-200)",
			});
		}
	}

	update_empty_cart_section(no_of_cart_items) {
		const $no_item_element = this.$cart_items_wrapper.find(".no-item-wrapper");

		no_of_cart_items > 0 &&
			$no_item_element &&
			$no_item_element.remove() &&
			this.$cart_header.css("display", "flex");

		no_of_cart_items === 0 && !$no_item_element.length && this.make_no_items_placeholder();
	}

	on_numpad_event($btn) {
		const current_action = $btn.attr("data-button-value");
		const action_is_field_edit = ["qty"].includes(current_action);
		const action_is_pressed_twice = this.prev_action === current_action;
		const first_click_event = !this.prev_action;
		const field_to_edit_changed = this.prev_action && this.prev_action != current_action;

		if (action_is_field_edit) {
			this.highlight_numpad_btn($btn, current_action);

			if (first_click_event || field_to_edit_changed) {
				this.prev_action = current_action;
			} else if (action_is_pressed_twice) {
				this.prev_action = undefined;
			}
			this.numpad_value = "";
		} else if (current_action === "checkout") {
			this.prev_action = undefined;
			this.toggle_item_highlight();
			this.events.numpad_event(undefined, current_action);
			return;
		} else if (current_action === "remove") {
			this.prev_action = undefined;
			this.toggle_item_highlight();
			this.events.numpad_event(undefined, current_action);
			return;
		} else {
			this.numpad_value =
				current_action === "delete"
					? this.numpad_value.slice(0, -1)
					: this.numpad_value + current_action;
			this.numpad_value = this.numpad_value || 0;
		}

		const first_click_event_is_not_field_edit = !action_is_field_edit && first_click_event;

		if (first_click_event_is_not_field_edit) {
			frappe.show_alert({
				indicator: "red",
				message: __("Please select a field to edit from numpad"),
			});
			frappe.utils.play_sound("error");
			return;
		}

		this.events.numpad_event(this.numpad_value, this.prev_action);
	}

	highlight_numpad_btn($btn, curr_action) {
		const curr_action_is_highlighted = $btn.hasClass("highlighted-numpad-btn");
		const curr_action_is_action = ["qty", "done"].includes(curr_action);

		if (!curr_action_is_highlighted) {
			$btn.addClass("highlighted-numpad-btn");
		}
		if (this.prev_action === curr_action && curr_action_is_highlighted) {
			$btn.removeClass("highlighted-numpad-btn");
		}
		if (this.prev_action && this.prev_action !== curr_action && curr_action_is_action) {
			const prev_btn = $(`[data-button-value='${this.prev_action}']`);
			prev_btn.removeClass("highlighted-numpad-btn");
		}
		if (!curr_action_is_action || curr_action === "done") {
			setTimeout(() => {
				$btn.removeClass("highlighted-numpad-btn");
			}, 200);
		}
	}

	toggle_numpad(show) {
		if (show) {
			this.$totals_section.css("display", "none");
			this.$numpad_section.css("display", "flex");
		} else {
			this.$totals_section.css("display", "flex");
			this.$numpad_section.css("display", "none");
		}
		this.reset_numpad();
	}

	reset_numpad() {
		this.numpad_value = "";
		this.prev_action = undefined;
		this.$numpad_section.find(".highlighted-numpad-btn").removeClass("highlighted-numpad-btn");
	}

	toggle_numpad_field_edit(fieldname) {
		if (["qty"].includes(fieldname)) {
			this.$numpad_section.find(`[data-button-value="${fieldname}"]`).click();
		}
	}

	clear_cart() {
		this.$cart_items_wrapper.html("");
		this.make_no_items_placeholder();
		this.highlight_checkout_btn(false);
		this.update_totals_section();
	}

	toggle_component(show) {
		show ? this.$component.css("display", "flex") : this.$component.css("display", "none");
	}
};
