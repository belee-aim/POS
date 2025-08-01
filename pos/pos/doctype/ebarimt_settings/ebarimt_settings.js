// Copyright (c) 2025, AIM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ebarimt Settings", {
	refresh(frm) {
        frm.add_custom_button(__('Send Data'), function() {
            frappe.call({
                method: "pos.api.ebarimt.send_data",
            });
        }, __('Actions')); // 'Actions' is the group label for the button
	},
});