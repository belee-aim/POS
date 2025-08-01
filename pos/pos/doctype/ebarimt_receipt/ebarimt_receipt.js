// Copyright (c) 2025, AIM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ebarimt Receipt", {
	refresh(frm) {
        frm.add_custom_button(__('Баримт буцаах'), function() {
            frappe.call({
                method: "pos.api.ebarimt.return_receipt",
                args: {
                    invoice_doc_name: frm.docname,
                }
            });
        }, __('Actions')); // 'Actions' is the group label for the button
	},
});