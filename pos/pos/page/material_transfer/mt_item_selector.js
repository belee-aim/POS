erpnext.MaterialTransfer.ItemSelector = class {
	constructor({ wrapper, events }) {
		this.wrapper = wrapper;
		this.events = events;

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.make_search_bar();
		this.load_items_data();
		this.bind_events();
		this.attach_shortcuts();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="items-selector">
				<div class="filter-section">
					<div class="label">${__("All Items")}</div>
					<div class="search-field"></div>
					<div class="item-group-field"></div>
				</div>
				<div class="items-container"></div>
			</section>`
		);

		this.$component = this.wrapper.find(".items-selector");
		this.$items_container = this.$component.find(".items-container");
	}

	async load_items_data() {
		if (!this.item_group) {
			const res = await frappe.call({
				method: "pos.pos.page.material_transfer.material_transfer_api.get_parent_item_group",
			});
			if (res.message) this.parent_item_group = res.message;
		}

		this.get_items({}).then(({ message }) => {
			this.render_item_list(message.items);
		});
	}

	get_items({ start = 0, page_length = 40, search_term = "" }) {
		let { item_group } = this;
		!item_group && (item_group = this.parent_item_group);

		const from_warehouse = this.events.get_from_warehouse();
		const to_warehouse = this.events.get_to_warehouse();

		return frappe.call({
			method: "pos.pos.page.material_transfer.material_transfer_api.get_items",
			freeze: true,
			args: {
				start,
				page_length,
				item_group,
				search_term,
				from_warehouse,
				to_warehouse,
			},
		});
	}

	refresh_items() {
		this.filter_items({ search_term: this.search_field?.get_value() || "" });
	}

	render_item_list(items) {
		this.$items_container.html("");
		this.items = items;

		items.forEach((item) => {
			const item_html = this.get_item_html(item);
			this.$items_container.append(item_html);
		});
	}

	get_item_html(item) {
		const me = this;
		const { item_image, actual_qty, uom, from_warehouse_qty, to_warehouse_qty } = item;

		let indicator_color;
		let qty_to_display = from_warehouse_qty || 0;

		indicator_color = qty_to_display > 10 ? "green" : qty_to_display <= 0 ? "red" : "orange";

		if (Math.round(qty_to_display) > 999) {
			qty_to_display = Math.round(qty_to_display) / 1000;
			qty_to_display = qty_to_display.toFixed(1) + "K";
		}

		function get_item_image_html() {
			if (item_image) {
				return `<div class="item-qty-pill">
							<span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
						</div>
						<div class="flex items-center justify-center border-b-grey text-6xl text-grey-100" style="height:8rem; min-height:8rem">
							<img
								onerror="cur_mt.item_selector.handle_broken_image(this)"
								class="h-full item-img" src="${item_image}"
								alt="${frappe.get_abbr(item.item_name)}"
							>
						</div>`;
			} else {
				return `<div class="item-qty-pill">
							<span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
						</div>
						<div class="item-display abbr">${frappe.get_abbr(item.item_name)}</div>`;
			}
		}

		function get_stock_info_html() {
			const from_qty = flt(from_warehouse_qty) || 0;
			const to_qty = flt(to_warehouse_qty) || 0;
			return `<div class="item-stock-info">
				<span class="from-stock" title="${__("Source warehouse stock")}">${from_qty}</span>
				<span class="stock-separator">/</span>
				<span class="to-stock" title="${__("Target warehouse stock")}">${to_qty}</span>
			</div>`;
		}

		return `<div class="item-wrapper"
				data-item-code="${escape(item.item_code)}"
				data-uom="${escape(uom || item.stock_uom)}"
				data-stock-uom="${escape(item.stock_uom)}"
				data-from-qty="${from_warehouse_qty || 0}"
				data-to-qty="${to_warehouse_qty || 0}"
				title="${item.item_name}">

				${get_item_image_html()}

				<div class="item-detail">
					<div class="item-name">
						${frappe.ellipsis(item.item_name, 18)}
					</div>
					${get_stock_info_html()}
				</div>
			</div>`;
	}

	handle_broken_image($img) {
		const item_abbr = $($img).attr("alt");
		$($img).parent().replaceWith(`<div class="item-display abbr">${item_abbr}</div>`);
	}

	make_search_bar() {
		const me = this;
		this.$component.find(".search-field").html("");
		this.$component.find(".item-group-field").html("");

		this.search_field = frappe.ui.form.make_control({
			df: {
				label: __("Search"),
				fieldtype: "Data",
				placeholder: __("Search by item code, serial number or barcode"),
			},
			parent: this.$component.find(".search-field"),
			render_input: true,
		});

		this.item_group_field = frappe.ui.form.make_control({
			df: {
				label: __("Item Group"),
				fieldtype: "Link",
				options: "Item Group",
				placeholder: __("Select item group"),
				onchange: function () {
					me.item_group = this.value;
					!me.item_group && (me.item_group = me.parent_item_group);
					me.filter_items();
				},
				get_query: function () {
					return {
						query: "pos.pos.page.material_transfer.material_transfer_api.item_group_query",
					};
				},
			},
			parent: this.$component.find(".item-group-field"),
			render_input: true,
		});

		this.search_field.toggle_label(false);
		this.item_group_field.toggle_label(false);

		this.attach_clear_btn();
	}

	attach_clear_btn() {
		this.search_field.$wrapper.find(".control-input").append(
			`<span class="link-btn" style="top: 2px;">
				<a class="btn-open no-decoration" title="${__("Clear")}">
					${frappe.utils.icon("close", "sm")}
				</a>
			</span>`
		);

		this.$clear_search_btn = this.search_field.$wrapper.find(".link-btn");

		this.$clear_search_btn.on("click", "a", () => {
			this.set_search_value("");
			this.search_field.set_focus();
		});
	}

	set_search_value(value) {
		$(this.search_field.$input[0]).val(value).trigger("input");
	}

	bind_events() {
		const me = this;

		this.$component.on("click", ".item-wrapper", function () {
			const $item = $(this);
			const item_code = unescape($item.attr("data-item-code"));
			let uom = unescape($item.attr("data-uom"));
			let stock_uom = unescape($item.attr("data-stock-uom"));
			let from_warehouse_qty = flt($item.attr("data-from-qty"));
			let to_warehouse_qty = flt($item.attr("data-to-qty"));

			uom = uom === "undefined" ? undefined : uom;
			stock_uom = stock_uom === "undefined" ? undefined : stock_uom;

			// Find the item data
			const item_data = me.items.find((i) => i.item_code === item_code);

			me.events.item_selected({
				field: "qty",
				value: "+1",
				item: {
					item_code,
					item_name: item_data?.item_name || item_code,
					uom,
					stock_uom,
					item_image: item_data?.item_image,
					from_warehouse_qty,
					to_warehouse_qty,
				},
			});
			me.search_field.set_focus();
		});

		this.search_field.$input.on("input", (e) => {
			clearTimeout(this.last_search);
			this.last_search = setTimeout(() => {
				const search_term = e.target.value;
				this.filter_items({ search_term });
			}, 300);

			this.$clear_search_btn.toggle(Boolean(this.search_field.$input.val()));
		});

		this.search_field.$input.on("focus", () => {
			this.$clear_search_btn.toggle(Boolean(this.search_field.$input.val()));
		});
	}

	attach_shortcuts() {
		const ctrl_label = frappe.utils.is_mac() ? "⌘" : "Ctrl";
		this.search_field.parent.attr("title", `${ctrl_label}+I`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+i",
			action: () => this.search_field.set_focus(),
			condition: () => this.$component.is(":visible"),
			description: __("Focus on search input"),
			ignore_inputs: true,
			page: cur_page.page.page,
		});

		this.item_group_field.parent.attr("title", `${ctrl_label}+G`);
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+g",
			action: () => this.item_group_field.set_focus(),
			condition: () => this.$component.is(":visible"),
			description: __("Focus on Item Group filter"),
			ignore_inputs: true,
			page: cur_page.page.page,
		});

		frappe.ui.keys.on("enter", () => {
			const selector_is_visible = this.$component.is(":visible");
			if (!selector_is_visible || this.search_field.get_value() === "") return;

			if (this.items.length == 1) {
				this.$items_container.find(".item-wrapper").click();
				frappe.utils.play_sound("submit");
				this.set_search_value("");
			} else if (this.items.length == 0 && this.barcode_scanned) {
				frappe.show_alert({
					message: __("No items found. Scan barcode again."),
					indicator: "orange",
				});
				frappe.utils.play_sound("error");
				this.barcode_scanned = false;
				this.set_search_value("");
			}
		});
	}

	filter_items({ search_term = "" } = {}) {
		if (search_term) {
			search_term = search_term.toLowerCase();

			this.search_index = this.search_index || {};
			if (this.search_index[search_term]) {
				const items = this.search_index[search_term];
				this.items = items;
				this.render_item_list(items);
				return;
			}
		}

		this.get_items({ search_term }).then(({ message }) => {
			const { items } = message;
			if (search_term) {
				this.search_index[search_term] = items;
			}
			this.items = items;
			this.render_item_list(items);
		});
	}

	resize_selector(minimize) {
		minimize
			? this.$component.find(".filter-section").css("grid-template-columns", "repeat(1, minmax(0, 1fr))")
			: this.$component.find(".filter-section").css("grid-template-columns", "repeat(12, minmax(0, 1fr))");

		minimize
			? this.$component.find(".search-field").css("margin", "var(--margin-sm) 0px")
			: this.$component.find(".search-field").css("margin", "0px var(--margin-sm)");

		minimize
			? this.$component.css("grid-column", "span 2 / span 2")
			: this.$component.css("grid-column", "span 6 / span 6");

		minimize
			? this.$items_container.css("grid-template-columns", "repeat(1, minmax(0, 1fr))")
			: this.$items_container.css("grid-template-columns", "repeat(4, minmax(0, 1fr))");
	}

	toggle_component(show) {
		this.set_search_value("");
		this.$component.css("display", show ? "flex" : "none");
	}
};
