frappe.provide("erpnext.MaterialTransfer");

frappe.pages["material-transfer"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Material Transfer"),
		single_column: true,
	});

	frappe.require("material_transfer.bundle.js", function () {
		wrapper.material_transfer = new erpnext.MaterialTransfer.Controller(wrapper);
		window.cur_mt = wrapper.material_transfer;
	});
};

frappe.pages["material-transfer"].refresh = function (wrapper) {
	if (wrapper.material_transfer) {
		wrapper.material_transfer.wrapper.html("");
		wrapper.material_transfer.init_app();
	}
};
