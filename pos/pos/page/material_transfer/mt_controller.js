erpnext.MaterialTransfer.Controller = class {
	constructor(wrapper) {
		this.wrapper = $(wrapper).find(".layout-main-section");
		this.page = wrapper.page;
		this.items = [];
		this.cart_items = {};

		this.init_app();
	}

	init_app() {
		this.prepare_dom();
		this.prepare_components();
		this.prepare_menu();
		this.load_warehouses();
	}

	prepare_dom() {
		this.wrapper.append(`<div class="material-transfer-app"></div>`);
		this.$components_wrapper = this.wrapper.find(".material-transfer-app");
	}

	prepare_components() {
		this.init_item_selector();
		this.init_item_cart();
		this.init_item_details();
	}

	prepare_menu() {
		this.page.clear_menu();
		this.page.add_menu_item(__("View Material Requests"), () => {
			frappe.set_route("List", "Material Request", {
				material_request_type: "Material Transfer",
			});
		});
	}

	async load_warehouses() {
		// Try to get POS Profile data (warehouse and company)
		const pos_profile = frappe.defaults.get_default("pos_profile");
		console.log("POS Profile:", pos_profile);
		if (pos_profile) {
			const profile_res = await frappe.call({
				method: "pos.pos.page.material_transfer.material_transfer_api.get_pos_profile_data",
				args: { pos_profile },
			});
			console.log("Profile data:", profile_res.message);
			if (profile_res.message) {
				this.company = profile_res.message.company;
				this.to_warehouse = profile_res.message.warehouse;
				console.log("Company:", this.company, "Warehouse:", this.to_warehouse);
				this.cart.set_company(this.company);
				this.cart.set_to_warehouse(this.to_warehouse);
			}
		}
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
				submit_request: () => this.submit_material_request(),
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

	async submit_material_request() {
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

		frappe.dom.freeze(__("Creating Material Request..."));

		try {
			const res = await frappe.call({
				method: "pos.pos.page.material_transfer.material_transfer_api.create_material_request",
				args: {
					items: items,
					from_warehouse: this.from_warehouse,
					to_warehouse: this.to_warehouse,
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
			}
		} catch (error) {
			console.error(error);
			frappe.show_alert({
				message: __("Failed to create Material Request"),
				indicator: "red",
			});
			frappe.utils.play_sound("error");
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
