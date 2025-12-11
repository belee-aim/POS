erpnext.MaterialTransfer.Controller = class {
	constructor(wrapper) {
		this.wrapper = $(wrapper).find(".layout-main-section");
		this.page = wrapper.page;
		this.items = [];
		this.cart_items = {};

		this.check_opening_entry();
	}

	fetch_opening_entry() {
		return frappe.call("erpnext.selling.page.point_of_sale.point_of_sale.check_opening_entry", {
			user: frappe.session.user,
		});
	}

	check_opening_entry() {
		this.fetch_opening_entry().then((r) => {
			if (r.message.length) {
				// Use the first open POS Opening Entry
				this.prepare_app_defaults(r.message[0]);
			} else {
				// No opening entry - show message to user
				this.show_opening_entry_required_message();
			}
		});
	}

	show_opening_entry_required_message() {
		this.wrapper.html(`
			<div class="flex flex-col items-center justify-center" style="height: 50vh;">
				<div class="text-muted" style="font-size: 1.2rem; text-align: center;">
					<p>${__("No POS Opening Entry found.")}</p>
					<p>${__("Please open a POS session first from the POS page.")}</p>
					<button class="btn btn-primary btn-sm mt-4" onclick="frappe.set_route('point-of-sale')">
						${__("Go to POS")}
					</button>
				</div>
			</div>
		`);
	}

	async prepare_app_defaults(data) {
		this.pos_opening = data.name;
		this.company = data.company;
		this.pos_profile = data.pos_profile;

		// Get warehouse from POS Profile
		const profile_res = await frappe.call({
			method: "pos.pos.page.material_transfer.material_transfer_api.get_pos_profile_data",
			args: { pos_profile: this.pos_profile },
		});

		if (profile_res.message) {
			this.to_warehouse = profile_res.message.warehouse;
		}

		this.init_app();
	}

	init_app() {
		this.prepare_dom();
		this.prepare_components();
		this.prepare_menu();
		this.prepare_fullscreen_btn();
		this.set_warehouse_data();
	}

	set_warehouse_data() {
		if (this.company) {
			this.cart.set_company(this.company);
		}
		if (this.to_warehouse) {
			this.cart.set_to_warehouse(this.to_warehouse);
		}
		// Load items after warehouse is set
		this.item_selector.refresh_items();
	}

	prepare_dom() {
		this.wrapper.append(`<div class="material-transfer-app"></div>`);
		this.$components_wrapper = this.wrapper.find(".material-transfer-app");
	}

	prepare_components() {
		this.init_item_selector();
		this.init_item_cart();
		this.init_item_details();
		this.init_request_dialog();
		this.init_recent_request_list();
		this.init_request_summary();
	}

	prepare_menu() {
		this.page.clear_menu();

		this.page.add_menu_item(
			__("Toggle Recent Requests"),
			this.toggle_recent_request.bind(this),
			false,
			"Ctrl+O"
		);
	}

	prepare_fullscreen_btn() {
		this.page.page_actions.find(".custom-actions").empty();

		this.page.add_button(__("Full Screen"), null, { btn_class: "btn-default fullscreen-btn" });

		this.bind_fullscreen_events();
	}

	bind_fullscreen_events() {
		this.$fullscreen_btn = this.page.page_actions.find(".fullscreen-btn");

		this.$fullscreen_btn.on("click", function () {
			if (!document.fullscreenElement) {
				document.documentElement.requestFullscreen();
			} else if (document.exitFullscreen) {
				document.exitFullscreen();
			}
		});

		$(document).on("fullscreenchange", this.handle_fullscreen_change_event.bind(this));
	}

	handle_fullscreen_change_event() {
		let enable_fullscreen_label = __("Full Screen");
		let exit_fullscreen_label = __("Exit Full Screen");

		if (document.fullscreenElement) {
			this.$fullscreen_btn[0].innerText = exit_fullscreen_label;
		} else {
			this.$fullscreen_btn[0].innerText = enable_fullscreen_label;
		}
	}

	toggle_recent_request() {
		const show = this.recent_request_list.$component.is(":hidden");
		this.toggle_recent_request_list(show);
	}

	toggle_recent_request_list(show) {
		this.toggle_components(!show);
		this.recent_request_list.toggle_component(show);
		this.request_summary.toggle_component(show);
	}

	init_item_selector() {
		this.item_selector = new erpnext.MaterialTransfer.ItemSelector({
			wrapper: this.$components_wrapper,
			events: {
				item_selected: (args) => this.on_cart_update(args),
				get_from_warehouse: () => this.from_warehouse,
				get_to_warehouse: () => this.to_warehouse,
			},
		});
	}

	init_item_cart() {
		this.cart = new erpnext.MaterialTransfer.ItemCart({
			wrapper: this.$components_wrapper,
			warehouses: this.warehouses,
			events: {
				cart_item_clicked: (item) => {
					const item_row = this.cart_items[item.item_code];
					this.item_details.toggle_item_details_section(item_row);
				},
				submit_request: () => this.show_request_dialog(),
				warehouse_changed: (type, warehouse) => {
					if (type === "from") {
						this.from_warehouse = warehouse;
					} else {
						this.to_warehouse = warehouse;
					}
					this.item_selector.refresh_items();
				},
				get_cart_items: () => this.cart_items,
			},
		});
	}

	init_item_details() {
		this.item_details = new erpnext.MaterialTransfer.ItemDetails({
			wrapper: this.$components_wrapper,
			events: {
				toggle_item_selector: (minimize) => {
					this.item_selector.resize_selector(minimize);
				},
				form_updated: (item, field, value) => {
					if (this.cart_items[item.item_code]) {
						this.cart_items[item.item_code][field] = value;
						this.cart.update_item_html(this.cart_items[item.item_code]);
						this.cart.update_totals_section();
					}
					return Promise.resolve();
				},
				remove_item_from_cart: () => this.remove_item_from_cart(),
				close_item_details: () => {
					this.item_details.toggle_item_details_section(null);
					this.cart.toggle_item_highlight();
				},
				get_from_warehouse: () => this.from_warehouse,
				get_to_warehouse: () => this.to_warehouse,
			},
		});
	}

	init_request_dialog() {
		this.request_dialog = new erpnext.MaterialTransfer.RequestDialog({
			wrapper: this.$components_wrapper,
			events: {
				on_submit: async (data) => {
					await this.submit_material_request(data);
				},
				on_close: () => {
					this.toggle_components(true);
				},
			},
		});
	}

	init_recent_request_list() {
		this.recent_request_list = new erpnext.MaterialTransfer.PastRequestList({
			wrapper: this.$components_wrapper,
			events: {
				open_request_data: (name) => {
					frappe.db.get_doc("Material Request", name).then((doc) => {
						this.request_summary.load_summary_of(doc);
					});
				},
				reset_summary: () => this.request_summary.toggle_summary_placeholder(true),
				go_back: () => {
					this.recent_request_list.toggle_component(false);
					this.request_summary.toggle_component(false);
					this.toggle_components(true);
				},
			},
		});
	}

	init_request_summary() {
		this.request_summary = new erpnext.MaterialTransfer.PastRequestSummary({
			wrapper: this.$components_wrapper,
			events: {
				new_request: () => {
					this.recent_request_list.toggle_component(false);
					this.request_summary.toggle_component(false);
					this.toggle_components(true);
				},
				on_transit_ended: () => {
					// Refresh the recent request list after transit is ended
					this.recent_request_list.refresh_list();
				},
			},
		});
	}

	async on_cart_update(args) {
		frappe.dom.freeze();
		try {
			let { field, value, item } = args;

			if (!this.from_warehouse) {
				frappe.dom.unfreeze();
				frappe.show_alert({
					message: __("Please select source warehouse first."),
					indicator: "orange",
				});
				frappe.utils.play_sound("error");
				return;
			}

			const item_code = item.item_code;
			const existing_item = this.cart_items[item_code];

			if (existing_item) {
				// Update existing item qty
				if (field === "qty") {
					const new_qty = value === "+1" ? flt(existing_item.qty) + 1 : flt(value);
					if (new_qty <= 0) {
						delete this.cart_items[item_code];
						this.cart.update_item_html({ item_code }, true);
					} else {
						// Check stock availability
						const available_qty = await this.get_available_stock(item_code, this.from_warehouse);
						if (new_qty > available_qty) {
							frappe.show_alert({
								message: __("Requested quantity ({0}) exceeds available stock ({1}) in source warehouse.", [new_qty, available_qty]),
								indicator: "orange",
							});
							frappe.utils.play_sound("error");
							frappe.dom.unfreeze();
							return;
						}
						existing_item.qty = new_qty;
						this.cart.update_item_html(existing_item);
					}
				}
			} else {
				// Add new item
				const qty = value === "+1" ? 1 : flt(value);
				if (qty <= 0) {
					frappe.dom.unfreeze();
					return;
				}

				// Check stock availability
				const available_qty = await this.get_available_stock(item_code, this.from_warehouse);
				if (qty > available_qty) {
					frappe.show_alert({
						message: __("Requested quantity ({0}) exceeds available stock ({1}) in source warehouse.", [qty, available_qty]),
						indicator: "orange",
					});
					frappe.utils.play_sound("error");
					frappe.dom.unfreeze();
					return;
				}

				this.cart_items[item_code] = {
					item_code: item.item_code,
					item_name: item.item_name,
					qty: qty,
					uom: item.uom || item.stock_uom,
					stock_uom: item.stock_uom,
					item_image: item.item_image,
					from_warehouse_qty: item.from_warehouse_qty,
					to_warehouse_qty: item.to_warehouse_qty,
				};
				this.cart.update_item_html(this.cart_items[item_code]);
			}

			this.cart.update_totals_section();
		} catch (error) {
			console.error(error);
		} finally {
			frappe.dom.unfreeze();
		}
	}

	async get_available_stock(item_code, warehouse) {
		const res = await frappe.call({
			method: "pos.pos.page.material_transfer.material_transfer_api.get_stock_availability",
			args: { item_code, warehouse },
		});
		return flt(res.message);
	}

	remove_item_from_cart() {
		const current_item = this.item_details.current_item;
		if (current_item && current_item.item_code) {
			delete this.cart_items[current_item.item_code];
			this.cart.update_item_html(current_item, true);
			this.cart.update_totals_section();
			this.item_details.toggle_item_details_section(null);
		}
	}

	show_request_dialog() {
		const items = Object.values(this.cart_items);

		if (!items.length) {
			frappe.show_alert({
				message: __("Please add items to create Material Request."),
				indicator: "orange",
			});
			frappe.utils.play_sound("error");
			return;
		}

		if (!this.from_warehouse) {
			frappe.show_alert({
				message: __("Please select source warehouse."),
				indicator: "orange",
			});
			frappe.utils.play_sound("error");
			return;
		}

		if (!this.to_warehouse) {
			frappe.show_alert({
				message: __("Please select target warehouse."),
				indicator: "orange",
			});
			frappe.utils.play_sound("error");
			return;
		}

		// Calculate totals
		let total_qty = 0;
		items.forEach((item) => {
			total_qty += flt(item.qty);
		});

		// Hide other components and show dialog
		this.toggle_components(false);
		this.request_dialog.show({
			from_warehouse: this.from_warehouse,
			to_warehouse: this.to_warehouse,
			total_items: items.length,
			total_qty: total_qty,
		});
	}

	async submit_material_request(data = {}) {
		const items = Object.values(this.cart_items);

		frappe.dom.freeze(__("Creating Material Request..."));

		try {
			const res = await frappe.call({
				method: "pos.pos.page.material_transfer.material_transfer_api.create_material_request",
				args: {
					items: items,
					from_warehouse: this.from_warehouse,
					to_warehouse: this.to_warehouse,
					schedule_date: data.schedule_date,
					remarks: data.remarks,
				},
			});

			if (res.message) {
				frappe.show_alert({
					message: __("Material Request {0} created successfully", [res.message.name]),
					indicator: "green",
				});
				frappe.utils.play_sound("submit");

				// Clear cart
				this.cart_items = {};
				this.cart.clear_cart();
				this.item_selector.refresh_items();
				this.toggle_components(true);
			}
		} catch (error) {
			console.error(error);
			frappe.show_alert({
				message: __("Failed to create Material Request"),
				indicator: "red",
			});
			frappe.utils.play_sound("error");
			this.toggle_components(true);
		} finally {
			frappe.dom.unfreeze();
		}
	}

	toggle_components(show) {
		this.cart.toggle_component(show);
		this.item_selector.toggle_component(show);
		!show && this.item_details.toggle_component(false);
	}
};
