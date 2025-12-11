erpnext.MaterialTransfer.PastRequestList = class {
	constructor({ wrapper, events }) {
		this.wrapper = wrapper;
		this.events = events;
		this.page_length = 20;
		this.current_page = 0;
		this.has_more = false;

		this.init_component();
	}

	init_component() {
		this.prepare_dom();
		this.make_filter_section();
		this.bind_events();
	}

	prepare_dom() {
		this.wrapper.append(
			`<section class="past-order-list">
				<div class="filter-section">
					<div class="label back-btn" style="cursor: pointer;">
						<svg class="icon icon-sm mr-2" style="vertical-align: middle;">
							<use href="#icon-left"></use>
						</svg>
						${__("Recent Requests")}
					</div>
					<div class="search-field"></div>
					<div class="status-field"></div>
				</div>
				<div class="invoices-container"></div>
				<div class="load-more-container text-center p-3" style="display: none;">
					<button class="btn btn-default btn-sm load-more-btn">${__("Load More")}</button>
				</div>
			</section>`
		);

		this.$component = this.wrapper.find(".past-order-list");
		this.$invoices_container = this.$component.find(".invoices-container");
		this.$load_more_container = this.$component.find(".load-more-container");
	}

	bind_events() {
		this.search_field.$input.on("input", (e) => {
			clearTimeout(this.last_search);
			this.last_search = setTimeout(() => {
				const search_term = e.target.value;
				this.refresh_list();
			}, 300);
		});
		const me = this;
		this.$invoices_container.on("click", ".invoice-wrapper", function () {
			const request_name = unescape($(this).attr("data-invoice-name"));

			me.events.open_request_data(request_name);
		});

		// Back button to return to main screen
		this.$component.find(".back-btn").on("click", () => {
			if (this.events.go_back) {
				this.events.go_back();
			}
		});

		// Load more button
		this.$load_more_container.find(".load-more-btn").on("click", () => {
			this.load_more();
		});
	}

	make_filter_section() {
		const me = this;
		this.search_field = frappe.ui.form.make_control({
			df: {
				label: __("Search"),
				fieldtype: "Data",
				placeholder: __("Search by request id"),
			},
			parent: this.$component.find(".search-field"),
			render_input: true,
		});
		this.status_field = frappe.ui.form.make_control({
			df: {
				label: __("Request Status"),
				fieldtype: "Select",
				options: `Pending\nIn Transit\nReceived`,
				placeholder: __("Filter by request status"),
				onchange: function () {
					if (me.$component.is(":visible")) me.refresh_list();
				},
			},
			parent: this.$component.find(".status-field"),
			render_input: true,
		});
		this.search_field.toggle_label(false);
		this.status_field.toggle_label(false);
		this.status_field.set_value("Pending");
	}

	refresh_list() {
		frappe.dom.freeze();
		this.events.reset_summary();
		this.current_page = 0;
		const search_term = this.search_field.get_value();
		const status = this.status_field.get_value();

		this.$invoices_container.html("");

		return frappe.call({
			method: "pos.pos.page.material_transfer.material_transfer_api.get_past_request_list",
			freeze: true,
			args: {
				search_term,
				status,
				page_length: this.page_length,
				start: 0,
			},
			callback: (response) => {
				frappe.dom.unfreeze();
				const requests = response.message || [];
				requests.forEach((request) => {
					const request_html = this.get_request_html(request);
					this.$invoices_container.append(request_html);
				});

				// Show/hide load more button
				this.has_more = requests.length >= this.page_length;
				this.$load_more_container.css("display", this.has_more ? "block" : "none");
			},
		});
	}

	load_more() {
		this.current_page++;
		const search_term = this.search_field.get_value();
		const status = this.status_field.get_value();
		const start = this.current_page * this.page_length;

		frappe.dom.freeze();

		return frappe.call({
			method: "pos.pos.page.material_transfer.material_transfer_api.get_past_request_list",
			freeze: true,
			args: {
				search_term,
				status,
				page_length: this.page_length,
				start,
			},
			callback: (response) => {
				frappe.dom.unfreeze();
				const requests = response.message || [];
				requests.forEach((request) => {
					const request_html = this.get_request_html(request);
					this.$invoices_container.append(request_html);
				});

				// Show/hide load more button
				this.has_more = requests.length >= this.page_length;
				this.$load_more_container.css("display", this.has_more ? "block" : "none");
			},
		});
	}

	get_request_html(request) {
		const transaction_date = frappe.datetime.str_to_user(request.transaction_date);
		return `<div class="invoice-wrapper" data-invoice-name="${escape(request.name)}">
				<div class="invoice-name-date">
					<div class="invoice-name">${request.name}</div>
					<div class="invoice-date">
						<svg class="mr-2" width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 21V8l9-6 9 6v13H3z"/>
							<path d="M9 21V12h6v9"/>
						</svg>
						${frappe.ellipsis(request.set_warehouse || "", 20)}
					</div>
				</div>
				<div class="invoice-total-status">
					<div class="invoice-total">${request.total_qty || 0} ${__("Items")}</div>
					<div class="invoice-date">${transaction_date}</div>
				</div>
			</div>
			<div class="seperator"></div>`;
	}

	toggle_component(show) {
		show
			? this.$component.css("display", "flex") && this.refresh_list()
			: this.$component.css("display", "none");
	}
};
