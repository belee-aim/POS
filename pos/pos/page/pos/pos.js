frappe.provide("erpnext.PointOfSale");
frappe.provide('ebarimt');
frappe.provide('Payments');

frappe.pages["pos"].on_page_load = function (wrapper) {
	const stickyTop = document.getElementsByClassName('sticky-top');
	$(stickyTop).find('header>div').css("display", "none");
	
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("POS"),
		single_column: true,
	});

	frappe.require("pos.bundle.js", function () {
		wrapper.pos = new erpnext.PointOfSale.Controller(wrapper);
		window.cur_pos = wrapper.pos;
	});
};

frappe.pages["pos"].refresh = function (wrapper) {
	if (document.scannerDetectionData) {
		onScan.detachFrom(document);
		wrapper.pos.wrapper.html("");
		wrapper.pos.check_opening_entry();
	}
};
